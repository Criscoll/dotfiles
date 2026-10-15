# Lion Travel 雄獅旅遊 (Taiwan OTA): probed, no watcher yet

Probed from the VPS on 2026-10-15 while setting up Alishan hotel watchers. No watcher uses it
yet, so there is no tested `check()`. Hotel-specific facts belong in a watcher's `config.json`.

## Endpoint (JSON POST, no cookies)

`POST https://hotel.liontravel.com/detail/gethotelproductdetail`, `Content-Type: application/json`, body
`{"HotelCode":"<code>","CheckIn":"YYYY-MM-DD","CheckOut":"YYYY-MM-DD","Rooms":[{"AdultQty":2,"ChildQty":0,"ChildAges":[]}]}`.
Works from the VPS with the template's browser UA. The base host came from the bundle
`hotel.liontravel.com/_webassets/lightspeed/subsitebundles/hotelpage-react/detail/detail.js`
(`Dw.hotelzkk.production`).

- Response: `{"Products":[...],"GoogleProductDetail":...,"ExtraTax":bool}`.
- Product: `RoomName`, `ProjectList[]`. Project (rate plan): `ProjectName`,
  `TotalB2CAmtIncludeDiscount` (TWD total for the stay), `AverageB2CAmt`, `MinAllowAllotmentQty`
  (rooms left), `AllowAllotmentStatus` (e.g. "只剩2間"), `RoomStatusCode`, `HotelDailyPriceList`.
- No stock or no inventory = empty `Products`. That looks the same as "this OTA doesn't carry
  the hotel", so prove a positive date first.

## Hotel codes seen (Chiayi / Alishan)

- Alishan Gou Hotel 阿里山閣 `TWCYIS23`: 0 products on the dates tried, while the direct engine had stock on some.
- Alishan House 阿里山賓館 `TWCYIS24`: works; stock mirrored the hotel's direct ec-hotel engine.
- Dafeng 大峯山莊 `TWCYIS39`: 0 products on every date tried (no inventory on Lion).

## Deep link

`https://hotel.liontravel.com/detail/<slug>?hotelCode=<code>`, e.g.
`https://hotel.liontravel.com/detail/tw-chiayi-dafeng-hotel?hotelCode=TWCYIS39`.
