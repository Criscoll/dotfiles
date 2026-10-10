# SevenRooms (restaurant booking widget)

Verified from the VPS on 2026-10-10 against a live venue. Venue-specific facts
(release times, party-size rules, phone numbers) belong in the watcher's
`config.json`, not here.

## Identify it

Booking page is `https://www.sevenrooms.com/explore/<venue_url_key>/reservations/create/search/`
(or the same widget embedded on the venue's own site). The page is an empty SPA
shell; all data comes from `api-yoa` JSON calls. Rung 1 of the probe ladder
(plain-HTTP JSON) works, with no auth, cookies or captcha.

## Endpoints (plain GET, no cookies)

- **Resolve venue ID:** `GET /api-yoa/dining/widget_info?venue_url_key=<key>` -> `data.base_venue.id`
  (long opaque string, stable; cache it). An unknown key is HTTP 404 "Venue not found".
- **Availability:** `GET /api-yoa/dining/availability?concierge_id=default&venue_ids=<id>&date=YYYY-MM-DD&party_size=N&time_slot=all`
  -> `data.availability[0].shift_results[].times[]`, each with `type`, `time` ("19:30"),
  `time_iso`, `is_requestable`.
  - `type == "book"`: instantly bookable. `type == "request"`: venue confirms manually.
  - Params are strictly validated: any unknown param is HTTP 400 ("Extra inputs are
    not permitted") with a `details[]` list. Use that to discover required fields.
  - Observed 2026-10-10: one venue returned only `request` slots for every day in the
    next 30 days (party 2 and 4). A watcher with the default `book`-only filter would
    never fire there, so probe the real `type` mix first and set `params.types`.
- **Seen in widget traffic, not probed standalone:**
  `/api-yoa/availability/ng/widget/range?venue=<key>&party_size=N&start_date=YYYY-MM-DD&num_days=1&halo_size_interval=100&channel=SEVENROOMS_WIDGET&exclude_pdr=true`
  (takes the url key directly) and `/api-yoa/availability/dates?venue=<key>&start_date=DD-MM-YYYY&num_days=31`.
- **Don't bother:** `/api-yoa/dining/` + `availability_search`, `search_availability`, `reservation`,
  `booking`, `reservations`, `reservation_hold`, `hold`, `book_reservation`,
  `create_reservation`, `reserve` all 404; `group_widget_info` 404s unless the venue
  uses the multi-venue group widget.
- The final booking submit uses reCAPTCHA Enterprise, which is why the watcher hands off to a human.

## Deep link

`https://www.sevenrooms.com/explore/<venue_url_key>/reservations/create/search/?date=YYYY-MM-DD&party_size=N`

**Verified 2026-10-10:** with a releasable date (`date=2026-10-22&party_size=2`) the
widget opens showing "2 Guests" and "22 Oct". Caveat: for a date not yet released
(`date=2026-12-14`, ~65 days out) party size still prefilled but the widget jumped to
the nearest date with availability (9 Nov). On release morning the link shows the
requested date.

## Ready-to-paste `check()`

Replace the block between the `SITE-SPECIFIC` markers in `watcher.py` with this
(tested with `--dry-run`: valid venue returns hits or none, bogus key exits 2).
`params`: `venue_url_key`, `date`, `party_size`, `window` ("HH:MM-HH:MM"), optional
`types` (default `["book"]`; add `"request"` for request-only venues).

```python
import functools


@functools.lru_cache(maxsize=None)
def sevenrooms_venue_id(venue_url_key):
    data = http_get_json(
        "https://www.sevenrooms.com/api-yoa/dining/widget_info",
        {"venue_url_key": venue_url_key},
    )
    try:
        return data["data"]["base_venue"]["id"]
    except (KeyError, TypeError) as e:
        raise CheckError(f"widget_info has no data.base_venue.id for '{venue_url_key}'") from e


def check(params):
    """SevenRooms: slots inside params.window whose type is in params.types.

    'book' = instantly bookable, 'request' = venue confirms manually. Default
    is book only; some venues show only 'request' slots.
    """
    types = params.get("types", ["book"])
    venue_id = sevenrooms_venue_id(params["venue_url_key"])
    data = http_get_json(
        "https://www.sevenrooms.com/api-yoa/dining/availability",
        {
            "concierge_id": "default",
            "venue_ids": venue_id,
            "date": params["date"],
            "party_size": params["party_size"],
            "time_slot": "all",
        },
    )
    try:
        shifts = data["data"]["availability"][0]["shift_results"]
    except (KeyError, IndexError, TypeError) as e:
        raise CheckError("unexpected availability shape (data.availability[0].shift_results)") from e
    lo, hi = params["window"].split("-")
    hits = {}
    for shift in shifts:
        for slot in shift.get("times", []):
            if slot.get("type") in types and lo <= slot["time"] <= hi:
                key = f"{params['date']}T{slot['time']}"
                hits[key] = Hit(key, f"{params['date']} {slot['time']} for {params['party_size']} [{slot['type']}] ({shift.get('name', 'shift')})")
    return sorted(hits.values(), key=lambda h: h.key)
```

The venue-ID lookup is cached per process (`lru_cache`), so a `--race` loop resolves
it once; each timer run resolves it once more (one extra cheap request).
