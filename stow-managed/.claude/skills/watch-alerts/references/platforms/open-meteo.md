# Open-Meteo + BoM observations (weather data)

Verified from the VPS on 2026-10-12 (Sydney). Location-specific facts (coordinates,
station, thresholds, advice wording) belong in the watcher's `config.json`, not here.

## Which source for what

- **Hourly forecast, any lat/lon:** Open-Meteo. No key, free for non-commercial use
  (~10k calls/day), CC BY 4.0 data.
- **Actuals (last ~72 h, half-hourly):** BoM station JSON. BoM's data-feeds page
  (`bom.gov.au/catalogue/data-feeds.shtml`) lists it as free and not for commercial use.
- **There is no sanctioned BoM hourly forecast feed.** The catalogue lists observations,
  daily/district forecasts and warnings only. Do not use `api.weather.bom.gov.au` (the
  app's backend): it is undocumented and its responses say the API must not be used,
  copied or shared.
- Probed and rejected: Open-Meteo `models=bom_access_global` and `/v1/bom` (see below).
  Not tested: MET Norway Locationforecast 2.0 (free, needs a User-Agent with contact
  info or it returns 403/429) and WillyWeather (key, cheap, BoM-derived).

## Open-Meteo

`GET https://api.open-meteo.com/v1/forecast`, plain GET, no auth.

- Params used: `latitude`, `longitude`, `hourly` (comma list), `models` (comma list),
  `start_date` / `end_date` (`YYYY-MM-DD`; worked for 3 days back and 2 days ahead),
  `timezone` (IANA name; times come back as local ISO strings with no offset).
- **Several models in one call:** `models=best_match,ecmwf_ifs025,icon_global,gfs_global,gem_global`
  returns keys suffixed `<var>_<model>` (e.g. `temperature_2m_icon_global`); all 144 hours
  were non-null for 6 variables x 5 models. Without `models`, keys are unsuffixed.
- Units default to degC and km/h. `wind_direction_10m` is degrees the wind blows FROM; take
  medians of u/v components, not of angles.
- **Errors:** HTTP 400 with `{"reason": "...", "error": true}`.
- **Silent failure to guard against:** a model can answer HTTP 200 with every value null.
  `models=bom_access_global` (and the dedicated `/v1/bom`) did this for Sydney on
  2026-10-12: accepted, 120 hours, zero non-null values. Treat a null anywhere in the used
  range as "model unavailable", drop it, and raise `CheckError` below a minimum model count.
- **Models disagree most around fronts.** For one Sydney night the midnight temperature
  ranged 19.6-25.3 degC across five models and the 21:00 dew point 12-19 degC. Use the
  median and report the range.
- Model 10 m wind runs a little high against station anemometers in sheltered suburbs
  (2-5 km/h forecast vs BoM "CALM"); fine for deciding "no useful breeze".

## BoM station observations

`GET https://www.bom.gov.au/fwo/IDN60901/IDN60901.<wmo>.json` (`IDN60901` = Sydney area;
other areas have their own product IDs on the data-feeds page). Station list with WMO
numbers: the `IDN60901.<wmo>.shtml` links on `https://www.bom.gov.au/nsw/observations/sydney.shtml`.

- Shape: `observations.data[]`, newest first. Fields used: `local_date_time_full`
  (`YYYYMMDDHHMMSS`, local time), `air_temp`, `apparent_t`, `dewpt`, `rel_hum`,
  `wind_dir` (`CALM`, `NW`, ...), `wind_spd_kmh`, `gust_kmh`. `lat`/`lon` are rounded to 0.1.
- Sydney Olympic Park (95765) and Canterbury (94766) returned 130-150 KB with ~72 h of
  half-hourly rows. Parramatta (94764) returned a 2.5 KB feed whose newest reading was
  ~23 h old: always check the row count in the window you need.
- **User-Agent:** plain `curl` UA -> HTTP 403 (1.4 KB). The template's single browser-style
  UA -> HTTP 200. Stop there: no rotation or other escalation (see `pitfalls.md`). If it
  starts returning 403 again, report it as infeasible. Plain `http://` 301s to `https://`.
- Keep it low-frequency (the sleep-prep watcher makes 1-2 requests a day).

## Deep link

BoM Sydney forecast: `https://www.bom.gov.au/location/australia/new-south-wales/metropolitan/bnsw_pt131-sydney`
(the older `https://www.bom.gov.au/nsw/forecasts/sydney.shtml` redirects there).

## Building blocks (tested via `--dry-run`, 2026-10-12)

Lifted from the `sleep-prep` watcher. They need `partial` (functools), `datetime`,
`timedelta`, `CheckError`, `http_get_json` from the template, plus the constants shown.

```python
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
BOM_OBS_URL = "https://www.bom.gov.au/fwo/IDN60901/IDN60901.{wmo}.json"
HOURLY_VARS = ("temperature_2m", "dew_point_2m", "wind_speed_10m", "wind_direction_10m", "precipitation")
SLEEP_TO = 30  # last hour wanted, as an offset from local midnight of the as-of day
HISTORY_DAYS = 2  # days of past hourly data wanted before the as-of day
BOM_MIN_ROWS = 12  # fewer rows than this in the window means a stale or truncated feed
BOM_WINDOW_HOURS = 10  # 21:00 -> 07:00


def row_at(rows, midnight, hours):
    when = midnight + timedelta(hours=hours)
    if when not in rows:
        raise CheckError(f"Open-Meteo has no hourly row for {when.isoformat(timespec='minutes')}")
    return rows[when]


def fetch_models(params, as_of):
    """Hourly columns per model from HISTORY_DAYS before as_of up to SLEEP_TO.

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


def median_series(by_model, var):
    return [statistics.median(vals) for vals in zip(*(c[var] for c in by_model.values()))]


def bom_actuals(params, as_of):
    """One line on last night (21:00 -> 07:00) at a BoM station; failures degrade to a note."""
    station = params["bom_station"]  # {"wmo": "95765", "name": "Sydney Olympic Park"}
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
```

## Worked example: `sleep-prep` (full source in `stow-managed/.local/share/watchers/sleep-prep/`)

The watcher (`~/.local/share/watchers/sleep-prep/`; home coordinates and station live in its untracked `config.local.json`) turns the above into one push per local day (key =
date, so the 15-minute retry never double-sends). Design notes worth reusing:

- **Heat-soak estimate:** exponentially smoothed outdoor temperature (tau 8 h) read at
  midnight, plus up to 3 degC for muggy air (dew point above 14 degC). Not a building
  model: tier edges are anchored to a night the occupant rated hot, so only the ordering
  of nights matters. The anchor night, edges and tier wording are all in `config.json`.
- **One Hit per run** carries its own `title` / `priority` / `tags` / `markdown`; the
  template's `Hit`, `notify()` and `run_once()` were extended in that watcher's copy for
  this (template unchanged).
- **Notification format (ntfy):** publish JSON with `"markdown": true`; the response then
  echoes `content_type: text/markdown`. The Android app renders it from v1.17.8. Supported:
  bold/italics, links, lists, blockquotes, headings, rules, code; tables are not on the
  list. Put each block in its own paragraph or list: CommonMark folds a single newline
  inside a paragraph (not checked how the app treats it). Put the link inline
  (`[label](url)`) and leave `click` unset (`deep_link: null`): with `click` set, tapping the
  notification opens that URL; without it, the tap opens the topic in the app.
- **Never returns `[]`:** a mild night still gets a short all-clear, so silence always
  means a broken watcher. `heartbeat_hours` is set very high because the daily push is the
  heartbeat.
- **Schedule:** `*-*-* 18:30/15:00 Australia/Sydney` (18:30 and 18:45 AEDT), expiry
  2027-03-31 (before DST ends on 2027-04-04; hour labels in the data are not DST-safe).
