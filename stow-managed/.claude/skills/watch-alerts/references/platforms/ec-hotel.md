# ec-hotel.net webhotel-v4 (Taiwan hotel booking engine)

Verified from the VPS on 2026-10-15 against a live Alishan hotel (hotel code `0905`).
Hotel-specific facts (hotel code, room codes, party size, nights) belong in the watcher's
`config.json`, not here.

## Identify it

Hotel's booking button goes to `https://tlathena.ec-hotel.net/webhotel-v4/<hotel code>/index?...`
(sometimes via `tl.ec-hotel.net`). Rung 1 (plain HTTP JSON) works, but only after a session handshake.
No captcha. Send the template's browser UA.

## Endpoints (cookie session; use a fresh `CookieJar` per stay)

1. **Session handshake:** `GET https://tlathena.ec-hotel.net/webhotel-v4/<code>/index?roomNum=1&checkin_date=YYYY-MM-DD&locale=en&checkout_date=YYYY-MM-DD&_rand=<ms epoch>`
   with header `Referer: https://tl.ec-hotel.net/`. The server 302s to the same path with its own
   `_rand`, then returns 200 HTML and sets `connect.sid` and `__cfwaitingroom` cookies.
   **Without** the Referer and `_rand`, tlathena 301s to `tl.ec-hotel.net`, which serves a JS
   auto-submit form that loops forever for non-JS clients.
2. **Availability:** `POST https://tlathena.ec-hotel.net/webhotel-v4/<code>/getCanSellProduct`,
   `Content-Type: application/json`, `Referer: .../webhotel-v4/<code>/index`, body
   `{"checkInDate":"YYYY/MM/DD","checkOutDate":"YYYY/MM/DD","night":1,"adult":2,"child":0,"ecoupon":[],"promotions":"","qnt":1,"urlSearch":true,"aegntEcoupon":[],"childAgeList":[]}`.

Gotchas:
- **The server uses the dates stored in the session by step 1 and ignores the body's dates.**
  Re-do step 1 for every stay, then assert `searchData.checkInDate` matches.
- **The body shape matters.** `promotions` must be `""` and `aegntEcoupon` must be `[]` (sic). Wrong
  types, or no session, give `{"success":false,"errorCode":"A209","errorMsg":"Cannot read properties of undefined (reading 'length')"}`.
- Response: `{"success":true,"AllRmProducts":[[product,...],...],"AllProducts":[...],"searchData":{...}}`.
  Product fields: `room_cod` (e.g. `SD`), `room_nam` (English with `locale=en`), `price` (TWD total for
  the stay), `type_name` (package/rate plan), `maxQnt`. A room type absent from `AllRmProducts`
  is sold out.
- Don't touch the cart calls (`checkStocks`, `AddtoShopping`): watchers are alert-only.

## Deep link

`https://tlathena.ec-hotel.net/webhotel-v4/<code>/index?locale=en&checkin_date=YYYY-MM-DD&checkout_date=YYYY-MM-DD&roomNum=1`
(the URL the hotel site's own booking button builds; browsers handle the redirect).

## Ready-to-paste `check()`

Tested with `--dry-run` on 2026-10-15 (a night with stock returned the 3 target room types, a sold-out
night 0). `params`: `hotel_code`, `target_rooms` (list of `room_cod`), `adults`, `nights` (list of
`YYYY-MM-DD`; each checked as one night). One hit per night and room code, at the cheapest package price.

```python
import http.cookiejar
from datetime import date, timedelta

# ec-hotel.net webhotel-v4: the index GET stores the stay dates in the session; getCanSellProduct then
# returns what's sellable for those session dates (it ignores the dates in its own body).
EC_BASE = "https://tlathena.ec-hotel.net/webhotel-v4/{}"


def ec_request(opener, req):
    try:
        with opener.open(req, timeout=HTTP_TIMEOUT_SEC) as resp:
            return resp.geturl(), resp.read()
    except urllib.error.HTTPError as e:
        body = e.read(300).decode("utf-8", "replace").strip()
        raise CheckError(f"HTTP {e.code} for {req.full_url}: {body}", status=e.code) from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise CheckError(f"request failed for {req.full_url}: {e}") from e


def check_night(hotel_code, night, adults):
    base = EC_BASE.format(hotel_code)
    checkout = (date.fromisoformat(night) + timedelta(days=1)).isoformat()
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    # Without the tl.ec-hotel.net Referer and _rand, tlathena bounces to a JS-only auto-submit form.
    query = urllib.parse.urlencode(
        {
            "roomNum": 1,
            "checkin_date": night,
            "locale": "en",
            "checkout_date": checkout,
            "_rand": int(time.time() * 1000),
        }
    )
    final_url, _ = ec_request(
        opener,
        urllib.request.Request(
            f"{base}/index?{query}",
            headers={"User-Agent": USER_AGENT, "Referer": "https://tl.ec-hotel.net/"},
        ),
    )
    if not final_url.startswith(base) or not any(c.name == "connect.sid" for c in jar):
        raise CheckError(f"{night}: session handshake failed (landed on {final_url})")

    body = {
        "checkInDate": night.replace("-", "/"),
        "checkOutDate": checkout.replace("-", "/"),
        "night": 1,
        "adult": adults,
        "child": 0,
        "ecoupon": [],
        "promotions": "",
        "qnt": 1,
        "urlSearch": True,
        "aegntEcoupon": [],
        "childAgeList": [],
    }
    _, raw = ec_request(
        opener,
        urllib.request.Request(
            f"{base}/getCanSellProduct",
            data=json.dumps(body).encode(),
            headers={
                "User-Agent": USER_AGENT,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Referer": f"{base}/index",
            },
        ),
    )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise CheckError(f"{night}: non-JSON getCanSellProduct response: {e}") from e
    if not isinstance(data, dict) or data.get("success") is not True:
        raise CheckError(f"{night}: getCanSellProduct failed: {str(data)[:200]}")
    echoed = (data.get("searchData") or {}).get("checkInDate")
    if echoed != body["checkInDate"]:
        raise CheckError(f"{night}: session dates mismatch (searchData.checkInDate={echoed!r})")
    if not isinstance(data.get("AllRmProducts"), list):
        raise CheckError(f"{night}: AllRmProducts missing or not a list")
    return [p for group in data["AllRmProducts"] for p in group]


def check(params):
    """Return [Hit, ...] for "available now", [] for "checked, nothing", or
    raise CheckError for "could not check". Keep that separation: it is what
    makes a silently broken watcher detectable."""
    hits = []
    targets = set(params["target_rooms"])
    for i, night in enumerate(params["nights"]):
        if i:
            time.sleep(1)
        cheapest = {}
        for p in check_night(params["hotel_code"], night, params["adults"]):
            try:
                cod, name, price = p["room_cod"], p["room_nam"], p["price"]
            except (KeyError, TypeError) as e:
                raise CheckError(f"{night}: product missing field {e}: {str(p)[:200]}") from e
            if cod in targets and (cod not in cheapest or price < cheapest[cod][1]):
                cheapest[cod] = (name, price)
        for cod, (name, price) in cheapest.items():
            hits.append(Hit(f"{night}:{cod}", f"{night}: {name} ({cod}) from NT${price:,}"))
    return hits
```
