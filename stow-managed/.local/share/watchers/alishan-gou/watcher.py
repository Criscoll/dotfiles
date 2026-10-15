#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Single-file availability watcher: probe -> condition -> ntfy push.

Copied per watch into ~/.local/share/watchers/<name>/ by `watchctl new`; only
check() below is site-specific. Reads config.json next to this file (plus an optional
config.local.json deep-merged over it), keeps state.json next to it, and logs one line per run to stdout (-> journald).

Modes:
  (default)      one check, for the systemd timer
  --race         loop every race.interval_sec for race.duration_min
  --dry-run      one check, print result, no notify, no state; exit 0 ok / 2 CheckError
  --test-notify  send one test push
"""

import argparse
import fcntl
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
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
import re
from datetime import date, timedelta

# Bespoke ASP.NET engine: one POST per room type and stay; selItem holds the bookable-quantity <option>s.
ROOM_QTY_URL = "https://www.agh.com.tw/App_UserControl/ajax_room_controll.ashx"
ROOM_PAGE_URL = "https://www.agh.com.tw/html/room/show.aspx?id={}"


def http_post_form_json(url, fields, headers=None):
    req_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    req_headers.update(headers or {})
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode(), headers=req_headers)
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


def check(params):
    """Return [Hit, ...] for "available now", [] for "checked, nothing", or
    raise CheckError for "could not check". Keep that separation: it is what
    makes a silently broken watcher detectable."""
    hits = []
    first = True
    for night in params["nights"]:
        checkout = (date.fromisoformat(night) + timedelta(days=1)).isoformat()
        for room_id, room_name in params["rooms"].items():
            if not first:
                time.sleep(1)
            first = False
            data = http_post_form_json(
                ROOM_QTY_URL,
                {"act": "room_qan", "item_v": room_id, "sdate": night, "edate": checkout},
            )
            if not isinstance(data, dict) or "success" not in data or "selItem" not in data:
                raise CheckError(f"{night} room {room_id}: unexpected response: {str(data)[:200]}")
            # Don't trust "success": some rooms report "true" with no bookable quantity.
            qty = max((int(v) for v in re.findall(r'<option value="(\d+)"', data["selItem"] or "")), default=0)
            if qty >= 1:
                hits.append(
                    Hit(f"{night}:{room_id}", f"{night}: {room_name} x{qty} {ROOM_PAGE_URL.format(room_id)}")
                )
    return hits


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


def notify(title, message, priority=3, click=None, tags=None):
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
        notify(
            cfg["title"],
            "\n".join(h.summary for h in new),
            priority=cfg["hit_priority"],
            click=cfg["deep_link"],
            tags=["tada"],
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
