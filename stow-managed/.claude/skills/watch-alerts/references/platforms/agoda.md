# Agoda (OTA)

Verified from the VPS on 2026-10-15 against Alishan hotels. Property-specific facts
(hotel ids, party size, nights) belong in the watcher's `config.json`, not here.

## Identify it / find the hotel id

Property pages look like `https://www.agoda.com/<slug>/hotel/<city>-<cc>.html`. The page HTML
contains `hotel_id=<n>`: `curl` the page with a browser UA and `grep -oE 'hotel_id=[0-9]+'`
(e.g. Dafeng Hotel `528785`, Ali-Shan Kaofeng Hotel `328620`, Shermuh `317859`, Alishan Gou
`17243874` via slug `alishan-gou-hotel-chiayi`). Guessed slugs don't always resolve
(`alishan-gou-hotel` and `alishan-house` didn't); use the slug from an Agoda search result. Rung 1 (plain-HTTP JSON) works: no cookies, auth or captcha.

## Endpoint (plain GET, no cookies)

`GET https://www.agoda.com/api/cronos/property/BelowFoldParams/GetSecondaryData` with
`finalPriceView=1, isShowMobileAppPrice=false, cid=-1, adults=2, children=0, rooms=1, checkIn=YYYY-MM-DD,
childAges=, travellerType=1, currencyCode=TWD, los=<nights>, hotel_id=<id>`, headers
`Accept: application/json`, `Referer: https://www.agoda.com/`. The response is about 180 KB.

- Fields used: `hotelInfo.name`, `hotelSearchCriteria.checkInDate` (echo of `checkIn`),
  `hotelSearchCriteria.los`, `roomGridData.{isDataReady, supplierCount, masterRooms[]}`,
  `currencyInfo.code`. `masterRooms[i]`: `id`, `name`, `rooms[]` (offers) with `availability`
  (int) and `price.display` (float).
- **No sellable rooms = empty `masterRooms`** (still `isDataReady: true`).
- **Listed but not sold on Agoda:** `isDataReady: false`, `supplierCount: 0` and no `masterRooms`
  key on every date, including dates the hotel's own engine had stock (Alishan Gou, 2026-10-15).
  Prove a positive on a sold date before watching such a property; the `check()` below raises
  `CheckError` on this state rather than reporting "nothing free".
- **Prices come back in USD** (`currencyInfo.code`) despite `currencyCode=TWD`, which is ignored
  without cookies. Always print the currency with the price.
- The page's `criticalApis` also list `graphql/property` and `api/v1/property/room-grid` (not probed).

## Deep link

`https://www.agoda.com/<slug>/hotel/<city>-<cc>.html?checkIn=YYYY-MM-DD&los=N&adults=2&rooms=1`

## Ready-to-paste `check()`

Tested with `--dry-run` on 2026-10-15 (a property with stock gave 4 hits, Dafeng on sold-out
nights 0). `params`: `hotel_id`, `adults`, `nights` (list of `YYYY-MM-DD`; each checked with `los=1`).
One hit per night and master room, carrying the max offer availability and cheapest offer price.

```python
# Agoda property page's secondary-data API: the room grid for one hotel, stay start and length.
AGODA_URL = "https://www.agoda.com/api/cronos/property/BelowFoldParams/GetSecondaryData"


def check(params):
    """Return [Hit, ...] for "available now", [] for "checked, nothing", or
    raise CheckError for "could not check". Keep that separation: it is what
    makes a silently broken watcher detectable."""
    hits = []
    for i, night in enumerate(params["nights"]):
        if i:
            time.sleep(1)
        data = http_get_json(
            AGODA_URL,
            params={
                "finalPriceView": 1,
                "isShowMobileAppPrice": "false",
                "cid": -1,
                "adults": params["adults"],
                "children": 0,
                "rooms": 1,
                "checkIn": night,
                "childAges": "",
                "travellerType": 1,
                "currencyCode": "TWD",
                "los": 1,
                "hotel_id": params["hotel_id"],
            },
            headers={"Referer": "https://www.agoda.com/"},
        )
        if not isinstance(data, dict):
            raise CheckError(f"{night}: unexpected response type {type(data).__name__}")
        grid = data.get("roomGridData")
        if not isinstance(grid, dict) or grid.get("isDataReady") is not True:
            raise CheckError(f"{night}: roomGridData missing or not ready")
        echoed = (data.get("hotelSearchCriteria") or {}).get("checkInDate", "")
        if not str(echoed).startswith(night):
            raise CheckError(f"{night}: checkInDate echo mismatch ({echoed!r})")
        rooms = grid.get("masterRooms")
        if not isinstance(rooms, list):
            raise CheckError(f"{night}: masterRooms missing or not a list")
        # Without cookies Agoda ignores currencyCode and prices in USD; report whatever it says.
        currency = (data.get("currencyInfo") or {}).get("code", "?")
        for master in rooms:
            offers = master.get("rooms") or []
            avail = max((o.get("availability") or 0 for o in offers), default=0)
            prices = [o["price"]["display"] for o in offers if (o.get("price") or {}).get("display")]
            price = f"{min(prices):,.2f} {currency}" if prices else "price n/a"
            hits.append(Hit(f"{night}:{master['id']}", f"{night}: {master['name']} x{avail} from {price}"))
    return hits
```
