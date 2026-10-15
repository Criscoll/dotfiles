# hotelplatform.com.tw "d2c" (Taiwan hotel booking engine)

Verified from the VPS on 2026-10-15 against a live Alishan hotel. Hotel-specific facts
(hotel/agent codes, party size, nights) belong in the watcher's `config.json`, not here.

## Identify it

Hotel's "book now" goes to `https://d2c.hotelplatform.com.tw/book_step1.aspx?HCode=<hotel>&AgCode=<agent>`.
The room list is filled by a form POST that returns an HTML fragment. Rung 1 of the probe
ladder (plain HTTP) works, with no cookies, auth or captcha. Send the template's browser UA.

## Endpoint (form POST, no cookies)

`POST https://d2c.hotelplatform.com.tw/scripts/room_rateplan_data.aspx`, form-urlencoded:
`HCode=<hotel code>` (e.g. `H4CT2005`), `AgCode=<agent code>` (e.g. `H4Ag141`), `Camp=` (empty),
`MDate=<nights>`, `lvcount=<adults>`.

- **`MDate` is the comma-joined list of stay nights** (`2027-01-12,2027-01-13,2027-01-14` for a
  3-night stay). One date checks one night. Slash-separated or otherwise malformed dates return
  a 43-byte `很抱歉找不到資料:選擇住房日期`.
- Response: HTML fragment, one `<li class="row room_li">` per room type.
  - Name: `<div class="ti">NAME</div>`.
  - Sold out: the block contains `沒有空房` ("您慢了一步...這段期間我們沒有空房了。").
  - Bookable: `<select name="ord_number" class="form-control ord_number" data-ord=YYYY-MM-DD|<rpno>|;>`
    with `<option value="N">` per bookable quantity.
  - Price: `data-cash=NNNN` (TWD total for the queried nights, tax included).
- The example hotel sold only 2-person rooms online, whatever `lvcount` said.
- Don't touch the cart/booking calls (`book_hotel_do.aspx` etc.): watchers are alert-only.

## Deep link

`https://d2c.hotelplatform.com.tw/book_step1.aspx?HCode=<hotel>&AgCode=<agent>&checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&lvcount=N`
(`checkIn`/`checkOut`/`lvcount` are read by `js/book_step1.core.js`).

## Ready-to-paste `check()`

Tested with `--dry-run` on 2026-10-15 (a night with stock gave 3 hits, a sold-out night 0).
`params`: `hcode`, `agcode`, `adults`, `nights` (list of `YYYY-MM-DD`; each checked as one night).

```python
import re

# hotelplatform.com.tw "d2c" engine: one HTML fragment per stay, one <li class="row room_li"> per room type.
RATEPLAN_URL = "https://d2c.hotelplatform.com.tw/scripts/room_rateplan_data.aspx"
SOLD_OUT_MARKER = "沒有空房"
NO_DATA_MARKER = "找不到資料"


def http_post_form(url, fields, headers=None):
    req_headers = {"User-Agent": USER_AGENT}
    req_headers.update(headers or {})
    req = urllib.request.Request(url, data=urllib.parse.urlencode(fields).encode(), headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT_SEC) as resp:
            return resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        body = e.read(300).decode("utf-8", "replace").strip()
        raise CheckError(f"HTTP {e.code} for {url}: {body}", status=e.code) from e
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise CheckError(f"request failed for {url}: {e}") from e


def check(params):
    """Return [Hit, ...] for "available now", [] for "checked, nothing", or
    raise CheckError for "could not check". Keep that separation: it is what
    makes a silently broken watcher detectable."""
    hits = []
    for night in params["nights"]:
        # MDate is the comma-joined list of stay nights; a single date checks one night.
        html = http_post_form(
            RATEPLAN_URL,
            {
                "HCode": params["hcode"],
                "AgCode": params["agcode"],
                "Camp": "",
                "MDate": night,
                "lvcount": params["adults"],
            },
        )
        if NO_DATA_MARKER in html:
            raise CheckError(f"{night}: engine says no data: {html[:200]}")
        blocks = html.split('<li class="row room_li"')[1:]
        if not blocks:
            raise CheckError(f"{night}: no room_li blocks in response: {html[:200]}")
        for block in blocks:
            name_m = re.search(r'<div class="ti">(.*?)</div>', block, re.S)
            if not name_m:
                raise CheckError(f"{night}: room block without a name: {block[:200]}")
            name = re.sub(r"<[^>]+>", "", name_m.group(1)).strip()
            select_m = re.search(r'<select name="ord_number"[^>]*>(.*?)</select>', block, re.S)
            if select_m:
                qty = max((int(v) for v in re.findall(r'<option value="(\d+)"', select_m.group(1))), default=0)
                if qty >= 1:
                    cash = re.search(r"data-cash=\"?(\d+)", block)
                    price = f"NT${int(cash.group(1)):,}" if cash else "price n/a"
                    hits.append(Hit(f"{night}:{name}", f"{night}: {name} x{qty} ({price})"))
            elif SOLD_OUT_MARKER not in block:
                raise CheckError(f"{night}: room '{name}' has neither ord_number nor sold-out marker")
        time.sleep(1)
    return hits
```
