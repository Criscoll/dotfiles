#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Nightly sleep-prep advisor: weather forecast -> heat-load tier -> ntfy push.

Copied per watch into ~/.local/share/watchers/<name>/ by `watchctl new`; only
check() below is site-specific (plus Hit's optional title/priority/tags, so each
day's push carries its own headline). Reads config.json next to this file, keeps
state.json next to it, and logs one line per run to stdout (-> journald).

Modes:
  (default)      one check, for the systemd timer
  --race         loop every race.interval_sec for race.duration_min
  --dry-run      one check, print result, no notify, no state; exit 0 ok / 2 CheckError
  --test-notify  send one test push
"""

import argparse
import fcntl
import json
import math
import os
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from functools import partial
from pathlib import Path
from zoneinfo import ZoneInfo

# Not .resolve(): when watcher.py is a stow symlink, state must stay beside the link, not in the repo.
HERE = Path(__file__).absolute().parent
CONFIG_PATH = HERE / "config.json"
CONFIG_LOCAL_PATH = HERE / "config.local.json"
STATE_PATH = HERE / "state.json"
LOCK_PATH = HERE / ".lock"
ENV_FILE = Path.home() / ".config" / "agent-scripts" / "env"

NTFY_URL = "https://ntfy.sh/"
# A realistic browser UA: some sites reject urllib's default outright.
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
# Long enough for a slow site, short enough that a hung socket can't eat a timer slot.
HTTP_TIMEOUT_SEC = 20
# ntfy caps messages at ~4 KB; stay under it so long hit lists still deliver.
NTFY_MAX_CHARS = 3500
# Sleep after an HTTP 429 in --race mode, instead of the usual 2-3 s interval.
RATE_LIMIT_BACKOFF_SEC = 30

CONFIG_DEFAULTS = {
    "jitter_sec": 0,
    "error_threshold": 3,
    "heartbeat_hours": 24,
    "hit_priority": 4,
    "params": {},
}
CONFIG_REQUIRED = ("name", "title", "deep_link", "expires", "timezone", "schedule")


class CheckError(Exception):
    """The check could not be performed (non-2xx, bad JSON shape, missing keys)."""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


@dataclass
class Hit:
    key: str  # stable dedupe key, e.g. "2026-12-14T19:30"
    summary: str
    title: str | None = None  # overrides config title for this push
    priority: int | None = None  # overrides config hit_priority
    tags: list[str] | None = None  # overrides the default ["tada"]
    markdown: bool = False  # message body is Markdown


def http_get_json(url, params=None, headers=None):
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    req_headers.update(headers or {})
    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SEC) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read(300).decode("utf-8", "replace").strip()
        raise CheckError(f"HTTP {e.code} for {url}: {body}", status=e.code) from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise CheckError(f"request failed for {url}: {e}") from e
    except json.JSONDecodeError as e:
        raise CheckError(f"non-JSON response from {url}: {e}") from e


# ==== SITE-SPECIFIC: check() ===============================================
# One question per local day: how heat-loaded will tonight's sleep be, and what should be
# switched on? Multi-model Open-Meteo forecast -> heat-soak estimate -> tier (config
# params.tiers), plus ventilation and AC-window advice. BoM station observations add last
# night's measured conditions (best effort, never fatal).
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
BOM_OBS_URL = "https://www.bom.gov.au/fwo/IDN60901/IDN60901.{wmo}.json"
HOURLY_VARS = (
    "temperature_2m",
    "dew_point_2m",
    "wind_speed_10m",
    "wind_direction_10m",
    "precipitation",
)
COMPASS = (
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
)  # fmt: skip
# Hours are offsets from local midnight of the as-of day: 22 = 22:00 tonight, 27 = 03:00 tomorrow.
NIGHT_FROM, NIGHT_TO = 21, 27  # window for the dew-point mean
LOAD_HOUR = 24  # the heat-soak estimate is read at midnight
SLEEP_FROM, SLEEP_TO = 22, 30  # hours considered for ventilation, AC blocks and showers
HISTORY_DAYS = 2  # days of past hourly data fed to the heat-soak smoother
BOM_MIN_ROWS = 12  # fewer rows than this in the night window means a stale or truncated feed
BOM_WINDOW_HOURS = 10  # 21:00 -> 07:00


def hour_label(hours):
    return f"{hours % 24:02d}:00"


def compass(deg):
    return COMPASS[int((deg % 360 + 11.25) // 22.5) % 16]


def wind_from(u, v):
    """Direction (degrees) the wind blows FROM, given components built by median_wind_components."""
    return (math.degrees(math.atan2(u, v)) + 360) % 360


def spans(hours):
    """Collapse whole hours into [first, last + 1) runs: [22, 23, 24, 27] -> [[22, 25], [27, 28]]."""
    runs = []
    for h in hours:
        if runs and runs[-1][1] == h:
            runs[-1][1] = h + 1
        else:
            runs.append([h, h + 1])
    return runs


def span_text(runs):
    return ", ".join(f"{hour_label(a)}-{hour_label(b)}" for a, b in runs)


def models_range(values, min_spread=3):
    """'models 20-25°' when the models disagree by at least min_spread degrees, else ''."""
    if max(values) - min(values) >= min_spread:
        return f"models {min(values):.0f}-{max(values):.0f}°"
    return ""


def dew_text(values, base_dew_point):
    """'16° (muggy; models 14-20°)': the median dew point, how muggy that is, model spread."""
    mid = statistics.median(values)
    label = "very muggy" if mid >= base_dew_point + 4 else "muggy" if mid >= base_dew_point + 2 else ""
    note = "; ".join(x for x in (label, models_range(values)) if x)
    return f"{mid:.0f}°" + (f" ({note})" if note else "")


def row_at(rows, midnight, hours):
    when = midnight + timedelta(hours=hours)
    if when not in rows:
        raise CheckError(f"Open-Meteo has no hourly row for {when.isoformat(timespec='minutes')}")
    return rows[when]


def fetch_models(params, as_of):
    """Hourly columns per model from HISTORY_DAYS before as_of up to 06:00 the next morning.

    Returns (at, by_model): at(hours) -> array index, by_model[model][var] -> list."""
    models = params["models"]
    data = http_get_json(
        OPEN_METEO_URL,
        {
            "latitude": params["latitude"],
            "longitude": params["longitude"],
            "hourly": ",".join(HOURLY_VARS),
            "models": ",".join(models),
            "start_date": (as_of - timedelta(days=HISTORY_DAYS)).isoformat(),
            "end_date": (as_of + timedelta(days=1)).isoformat(),
            "timezone": params["timezone"],
        },
    )
    if data.get("error"):
        raise CheckError(f"Open-Meteo error: {data.get('reason')}")
    hourly = data.get("hourly")
    if not isinstance(hourly, dict) or "time" not in hourly:
        raise CheckError("Open-Meteo response has no hourly.time")
    rows = {datetime.fromisoformat(t): i for i, t in enumerate(hourly["time"])}
    at = partial(row_at, rows, datetime(as_of.year, as_of.month, as_of.day))
    at(-HISTORY_DAYS * 24)  # the smoother needs the history: raises CheckError if it is missing
    last = at(SLEEP_TO)
    by_model = {}
    for model in models:
        cols = {v: hourly.get(f"{v}_{model}") for v in HOURLY_VARS}
        # A model can answer 200 with all-null arrays (bom_access_global did); skip it.
        if any(c is None or len(c) <= last or None in c[: last + 1] for c in cols.values()):
            continue
        by_model[model] = {v: c[: last + 1] for v, c in cols.items()}
    if len(by_model) < params["min_models"]:
        raise CheckError(f"only {len(by_model)} of {len(models)} models returned complete data")
    return at, by_model


def soak(temps, tau_hours):
    """Exponentially smoothed outdoor temperature: a crude stand-in for stored house heat.

    Not a building model. The tier edges are anchored to a night the occupant rated hot
    (config params.anchor), so only the ordering of nights matters, not the absolute value."""
    alpha = 1 - math.exp(-1 / tau_hours)
    est, out = temps[0], []
    for temp in temps:
        est += alpha * (temp - est)
        out.append(est)
    return out


def humidity_bump(dew_point, bump):
    """Muggy air stops sweat evaporating: add up to bump['max'] degrees of load."""
    return min(max((dew_point - bump["base_dew_point"]) * bump["per_degree"], 0.0), bump["max"])


def tier_of(load, edges):
    return sum(load >= edge for edge in edges)


def assess(cols, at, params):
    """Heat load for one model: smoothed outdoor temperature at midnight plus the muggy bump."""
    soaked = soak(cols["temperature_2m"], params["soak_tau_hours"])
    dew_mean = statistics.fmean(cols["dew_point_2m"][at(NIGHT_FROM) : at(NIGHT_TO) + 1])
    return {
        "load": soaked[at(LOAD_HOUR)] + humidity_bump(dew_mean, params["humidity_bump"]),
        "dew_mean": dew_mean,
    }


def median_series(by_model, var):
    return [statistics.median(vals) for vals in zip(*(c[var] for c in by_model.values()))]


def median_wind_components(by_model):
    """Per-hour median wind as (u, v) components; medianing components avoids angle wrap-around."""
    us, vs = [], []
    for cols in by_model.values():
        rad = [math.radians(d) for d in cols["wind_direction_10m"]]
        us.append([s * math.sin(r) for s, r in zip(cols["wind_speed_10m"], rad, strict=True)])
        vs.append([s * math.cos(r) for s, r in zip(cols["wind_speed_10m"], rad, strict=True)])
    return (
        [statistics.median(x) for x in zip(*us)],
        [statistics.median(x) for x in zip(*vs)],
    )


def wind_clause(speed, u, v, at):
    """'SSW 10 km/h until midnight, then SSE 7 km/h', or 'calm all night'."""

    def segment(first, last):
        rows = range(at(first), at(last) + 1)
        mean_speed = statistics.fmean(speed[i] for i in rows)
        direction = wind_from(statistics.fmean(u[i] for i in rows), statistics.fmean(v[i] for i in rows))
        return "calm" if mean_speed < 2 else f"{compass(direction)} {mean_speed:.0f} km/h"

    early, late = segment(NIGHT_FROM, LOAD_HOUR), segment(LOAD_HOUR + 1, SLEEP_TO)
    return f"{late} all night" if early == late else f"{early} until midnight, then {late}"


def window_advice(t, soaked, speed, u, v, at, params):
    """Is there cooler outside air AND a breeze that pushes it into the openings?"""
    vent, side = params["ventilation"], params["facing_label"]
    cooler, open_hours = [], []
    for h in range(SLEEP_FROM, SLEEP_TO + 1):
        i = at(h)
        if t[i] > soaked[i] - vent["min_cooler_by"]:
            continue
        cooler.append(h)
        angle = math.radians(wind_from(u[i], v[i]) - params["facing_deg"])
        if speed[i] * max(0.0, math.cos(angle)) >= vent["min_into_kmh"]:
            open_hours.append(h)
    runs = [r for r in spans(open_hours) if r[1] - r[0] >= 2]
    if runs:
        return (
            f"open the {side} windows/door {span_text(runs)}; outside is cooler and the breeze "
            "pushes in, so the ducted fan has cooler air to pull from the main room."
        )
    if cooler:
        return (
            f"outside is cooler from ~{hour_label(cooler[0])}, but no breeze into the {side} "
            "side; opening up helps little."
        )
    return "outside stays warmer than the house; keep it shut."


def ac_blocks(soaked, at, params, tier):
    """Hours (as a span list) where the estimated house temperature is still above comfort."""
    threshold = params["ac_house_threshold"] - (1 if tier >= len(params["tier_edges"]) else 0)
    hours = [h for h in range(SLEEP_FROM, SLEEP_TO + 1) if soaked[at(h)] >= threshold]
    return span_text(spans(hours))


def shower_text(precip, at):
    wet = [h for h in range(SLEEP_FROM, SLEEP_TO + 1) if precip[at(h)] >= 0.2]
    return f"Showers {span_text(spans(wet))}" if wet else ""


def bom_actuals(params, as_of):
    """One line on last night's measured conditions; failures degrade to a note, never raise."""
    station = params["bom_station"]
    try:
        data = http_get_json(BOM_OBS_URL.format(wmo=station["wmo"]))
        midnight = datetime(as_of.year, as_of.month, as_of.day)
        first = (midnight - timedelta(hours=3)).strftime("%Y%m%d%H%M%S")
        last = (midnight + timedelta(hours=7)).strftime("%Y%m%d%H%M%S")
        night = sorted(
            (
                r
                for r in data["observations"]["data"]
                if first <= r["local_date_time_full"] <= last and r["air_temp"] is not None
            ),
            key=lambda r: r["local_date_time_full"],
        )
        if len(night) < BOM_MIN_ROWS:
            return f"Last night actual: only {len(night)} observations found (feed stale?)."
        calm_share = sum((r["wind_spd_kmh"] or 0) <= 2 for r in night) / len(night)
        humidity = max(r["rel_hum"] for r in night if r["rel_hum"] is not None)
        return (
            f"Last night actual: min {min(r['air_temp'] for r in night):.1f}°, "
            f"RH up to {humidity}%, calm {calm_share * BOM_WINDOW_HOURS:.0f} of {BOM_WINDOW_HOURS} h."
        )
    except (CheckError, KeyError, TypeError, ValueError) as e:
        return f"Last night actual: unavailable ({type(e).__name__}: {e})."


def check(params):
    """Return one Hit per local day (key = date) carrying tonight's advice, or raise
    CheckError when the forecast cannot be trusted. Never returns []: even a mild night
    gets a short all-clear, so silence always means a broken watcher."""
    if len(params["tiers"]) != len(params["tier_edges"]) + 1:
        raise CheckError("config: params.tiers needs exactly one more entry than tier_edges")
    tz = ZoneInfo(params["timezone"])
    # as_of_date is a test hook for the dev harness; production always uses today.
    as_of = (
        date.fromisoformat(params["as_of_date"])
        if params.get("as_of_date")
        else datetime.now(tz).date()
    )
    at, by_model = fetch_models(params, as_of)

    per_model = [assess(cols, at, params) for cols in by_model.values()]
    edges = params["tier_edges"]
    load = statistics.median(a["load"] for a in per_model)
    tier = tier_of(load, edges)
    tiers = [tier_of(a["load"], edges) for a in per_model]

    t = median_series(by_model, "temperature_2m")
    speed = median_series(by_model, "wind_speed_10m")
    precip = median_series(by_model, "precipitation")
    u, v = median_wind_components(by_model)
    soaked = soak(t, params["soak_tau_hours"])

    bed = params["bedtime_hour"]
    tc = params["tiers"][tier]
    # (hour, median temperature, models-disagree note) at bedtime, midnight, 03:00 and 06:00.
    # Only the hour the models disagree on most gets a note, to keep the list glanceable.
    hourly = [
        (h, [cols["temperature_2m"][at(h)] for cols in by_model.values()])
        for h in (bed, LOAD_HOUR, 27, 30)
    ]
    widest = max(range(len(hourly)), key=lambda i: max(hourly[i][1]) - min(hourly[i][1]))
    samples = []
    for i, (h, values) in enumerate(hourly):
        note = f" ({r})" if i == widest and (r := models_range(values)) else ""
        samples.append((h, statistics.median(values), note))
    dew = dew_text([a["dew_mean"] for a in per_model], params["humidity_bump"]["base_dew_point"])
    wind = wind_clause(speed, u, v, at)

    # Markdown, one paragraph per block: list items and blank lines are what the phone apps
    # render reliably, single newlines inside a paragraph are not.
    parts = [f"> {tc['advice'].format(bed=hour_label(bed), pre=hour_label(bed - 1))}"]
    if tier == 0:
        temps = ", ".join(f"{mid:.0f}° at {hour_label(h)}" for h, mid, _ in samples)
        parts.append(f"Outside {temps}. Dew point {dew}, wind {wind}.")
    else:
        if tier >= 3 and (blocks := ac_blocks(soaked, at, params, tier)):
            parts.append(f"**AC on:** {blocks}, while the house is still warm.")
        outside = "\n".join(f"- {hour_label(h)}: **{mid:.0f}°**{note}" for h, mid, note in samples)
        air = [
            f"Dew point {dew}, wind {wind}",
            f"**Windows:** {window_advice(t, soaked, speed, u, v, at, params)}",
            shower_text(precip, at),
        ]
        anchor = params["anchor"]
        agree = "models agree" if min(tiers) == max(tiers) else f"models split {min(tiers)}-{max(tiers)}"
        parts += [
            f"**Outside**\n\n{outside}",
            "**Air**\n\n" + "\n".join(f"- {item}" for item in air if item),
            f"**Load {load:.0f}** vs {anchor['load']:.0f} on your hot night ({anchor['label']}). "
            f"Tier {tier} of {len(edges)}, {agree}.",
        ]
    if len(by_model) < len(params["models"]):
        parts.append(f"Only {len(by_model)} of {len(params['models'])} models answered.")
    parts.append(bom_actuals(params, as_of))
    link = params["link"]
    parts.append(f"[{link['label']}]({link['url']})")

    return [
        Hit(
            key=as_of.isoformat(),
            summary="\n\n".join(parts),
            title=tc["title"],
            priority=tc["priority"],
            tags=tc["tags"],
            markdown=True,
        )
    ]


# ==== END SITE-SPECIFIC ====================================================


def load_ntfy_topic():
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if topic:
        return topic
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[len("export ") :].strip()
            if line.startswith("NTFY_TOPIC="):
                return line.split("=", 1)[1].strip().strip("'\"")
    sys.exit(f"NTFY_TOPIC not set (env or {ENV_FILE})")


def notify(title, message, priority=3, click=None, tags=None, markdown=False):
    payload = {
        "topic": load_ntfy_topic(),
        "title": title,
        "message": message[:NTFY_MAX_CHARS],
        "priority": priority,
    }
    if click:
        payload["click"] = click
    if tags:
        payload["tags"] = tags
    if markdown:
        payload["markdown"] = True
    # JSON publish, not header publish: urllib headers must be latin-1.
    req = urllib.request.Request(
        NTFY_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SEC):
        pass


def deep_merge(base, override):
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(base.get(key), dict):
            deep_merge(base[key], value)
        else:
            base[key] = value
    return base


def load_config():
    cfg = dict(CONFIG_DEFAULTS)
    cfg.update(json.loads(CONFIG_PATH.read_text()))
    if CONFIG_LOCAL_PATH.exists():
        deep_merge(cfg, json.loads(CONFIG_LOCAL_PATH.read_text()))
    missing = [k for k in CONFIG_REQUIRED if k not in cfg]
    if missing:
        sys.exit(f"config.json missing fields: {', '.join(missing)}")
    return cfg


def utcnow():
    return datetime.now(UTC)


def load_state():
    state = {
        "notified_keys": [],
        "consecutive_errors": 0,
        "error_alerted": False,
        "last_heartbeat": None,
        "checks_since_heartbeat": 0,
        "errors_since_heartbeat": 0,
    }
    if STATE_PATH.exists():
        state.update(json.loads(STATE_PATH.read_text()))
    return state


def save_state(state):
    tmp = STATE_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2))
    os.replace(tmp, STATE_PATH)


def log(name, msg):
    print(f"{name} | {msg}", flush=True)


def is_expired(cfg):
    today = datetime.now(ZoneInfo(cfg["timezone"])).date().isoformat()
    return today > cfg["expires"]


def expire(cfg):
    name = cfg["name"]
    notify(
        f"Watcher expired: {cfg['title']}",
        f"{name} passed its expiry date ({cfg['expires']}) and has stopped itself.",
        priority=2,
    )
    for unit in (f"watcher-{name}.timer", f"watcher-{name}-race.timer"):
        # The race timer may not exist; a missing unit is not an error.
        subprocess.run(["systemctl", "--user", "disable", "--now", unit], check=False)
    log(name, "expired; timers disabled")


def heartbeat_due(cfg, state):
    last = state["last_heartbeat"]
    if last is None:
        return False
    age = utcnow() - datetime.fromisoformat(last)
    return age.total_seconds() >= cfg["heartbeat_hours"] * 3600


def run_once(cfg, state):
    """One check plus alert/state bookkeeping. Returns (outcome, CheckError|None)."""
    name = cfg["name"]
    if state["last_heartbeat"] is None:
        state["last_heartbeat"] = utcnow().isoformat()
    state["checks_since_heartbeat"] += 1

    try:
        hits = check(cfg["params"])
    except Exception as e:  # noqa: BLE001 - an unexpected bug in check() must count as an error, not kill the run
        err = e if isinstance(e, CheckError) else CheckError(f"{type(e).__name__}: {e}")
        state["consecutive_errors"] += 1
        state["errors_since_heartbeat"] += 1
        if state["consecutive_errors"] >= cfg["error_threshold"] and not state["error_alerted"]:
            notify(
                f"Watcher failing: {cfg['title']}",
                f"{state['consecutive_errors']} failed checks in a row. Last error: {err}",
                priority=3,
                tags=["warning"],
            )
            state["error_alerted"] = True
        log(name, f"error | consecutive={state['consecutive_errors']} | {err}")
        return "error", err

    if state["error_alerted"]:
        notify(f"Watcher recovered: {cfg['title']}", "Checks are working again.", priority=2)
    state["consecutive_errors"] = 0
    state["error_alerted"] = False

    new = [h for h in hits if h.key not in state["notified_keys"]]
    if new:
        lead = new[0]  # one Hit per run in practice; its overrides style the push
        notify(
            lead.title or cfg["title"],
            "\n".join(h.summary for h in new),
            priority=lead.priority or cfg["hit_priority"],
            click=cfg["deep_link"],
            tags=lead.tags or ["tada"],
            markdown=lead.markdown,
        )
        # Record only after the push succeeded, so a failed push retries next run.
        state["notified_keys"].extend(h.key for h in new)
    log(name, f"ok | hits={len(hits)} new={len(new)}")

    if heartbeat_due(cfg, state):
        notify(
            f"Still watching: {cfg['title']}",
            f"{state['checks_since_heartbeat']} checks, {state['errors_since_heartbeat']} errors "
            "since the last heartbeat.",
            priority=2,
        )
        state["last_heartbeat"] = utcnow().isoformat()
        state["checks_since_heartbeat"] = 0
        state["errors_since_heartbeat"] = 0
    return "ok", None


def run_race(cfg, state):
    race = cfg["race"]
    interval = race["interval_sec"]
    deadline = time.monotonic() + race["duration_min"] * 60
    log(cfg["name"], f"race start | every {interval}s for {race['duration_min']} min")
    while time.monotonic() < deadline:
        started = time.monotonic()
        _, err = run_once(cfg, state)
        save_state(state)
        if err is not None and err.status == 429:
            time.sleep(RATE_LIMIT_BACKOFF_SEC)
        else:
            time.sleep(max(0, interval - (time.monotonic() - started)))
    log(cfg["name"], "race end")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--race", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--test-notify", action="store_true")
    args = parser.parse_args()

    cfg = load_config()

    if args.test_notify:
        notify(f"Test: {cfg['title']}", "watch-alerts test push", priority=3, click=cfg["deep_link"])
        print("test push sent")
        return 0

    if args.dry_run:
        try:
            hits = check(cfg["params"])
        except CheckError as e:
            print(f"CheckError: {e}")
            return 2
        print(f"{len(hits)} hit(s)")
        for h in hits:
            print(f"{h.key} | {h.summary}")
        return 0

    lock = open(LOCK_PATH, "w")  # noqa: SIM115 - held open for the whole process to keep the flock
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        log(cfg["name"], "another run holds the lock; skipping")
        return 0

    if is_expired(cfg):
        expire(cfg)
        return 0

    state = load_state()
    try:
        if args.race:
            if "race" not in cfg:
                sys.exit("config.json has no 'race' block")
            run_race(cfg, state)
            return 0
        outcome, _ = run_once(cfg, state)
        return 0 if outcome == "ok" else 2
    finally:
        save_state(state)


if __name__ == "__main__":
    sys.exit(main())
