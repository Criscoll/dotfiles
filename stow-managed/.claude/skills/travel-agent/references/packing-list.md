# Packing List

How to produce a trip-specific packing list: a tick-off checklist in its own
dedicated file, tailored to *this* trip, then reviewed for obvious omissions.
The value isn't a generic list — the traveler already knows to pack clothes.
It's the tailoring (season, activities, baggage limits) and catching the thing
they forgot (the plug adapter, the visa printout, enough of a prescription).

## Where it lives — its own dedicated file, with checkboxes

Write the list to its own file — `packing.md` inside the `Travel_<Name>` task
directory — not buried in `outline.md`. The outline stays decision-relevant
(brief, conclusions); the packing list is a live working document the traveler
ticks off as they pack, so it earns its own file.

Use markdown checkboxes so items can be checked off, grouped under category
headings:

```markdown
# Packing — Taiwan, 15–25 Nov 2026 (carry-on only)

## Documents & money
- [ ] Passport (expires 2028-03 — valid ✓)
- [ ] Taiwan visa-exempt entry confirmed — no visa needed (see outline)
- [ ] Travel insurance policy (PDF on phone + printout)
- [ ] Booking confirmations (flights, hotels)
- [ ] Cash: some TWD for arrival; cards (Wise, no-FX-fee card)

## Electronics
- [ ] Phone + charger
- [ ] Plug adapter — Taiwan uses Type A/B (same as US); check hotel voltage 110V
- [ ] Power bank (carry-on only — must be in cabin bag, not checked)
- [ ] Laptop + charger

## Clothing (Nov = mild, 18–24°C, some rain)
- [ ] Light layers + one warm layer for evenings
- [ ] Packable rain jacket / compact umbrella
- [ ] Comfortable walking shoes (lots of city walking per itinerary)
```

Keep it a working checklist, not prose. Don't recreate it in `outline.md`; if
the outline needs to reference it, link to the file.

A **reusable base list** the traveler clones for future trips is different — that
belongs in `01_Notes/06_Travel/` per the `notes` skill (durable, cross-trip),
and each trip's `packing.md` starts as a copy of it. The per-trip file in the
task directory is the one that gets ticked off.

## Tailor to the trip — don't emit a generic list

Pull the inputs from research and the rest of the plan rather than guessing:

- **Season / climate at the destination for the travel dates** — from the
  weather research already gathered (Date Planning / itinerary research). Pack
  for the actual forecast range, not the country's stereotype. A place that's
  hot in summer can need a warm layer in the travel month — call the mismatch
  out explicitly.
- **Activities** — from the itinerary. Hiking → boots + daypack; beach →
  swimwear + reef-safe sunscreen; a nice dinner or event → one smart outfit;
  snow → thermals (or note gear is cheaper to rent on arrival than to fly with).
- **Trip length + laundry cadence** — enough clothing for the gap between washes,
  not one set per day for a three-week trip.
- **Baggage constraints from the chosen flights** — carry-on-only changes the
  list materially: liquids ≤100ml, no oversized/prohibited items in cabin,
  power banks *must* be in the cabin bag. State the constraint at the top of the
  file so every item is chosen against it.
- **Health / personal needs** — prescriptions (original packaging, enough for
  the trip plus a buffer), and anything hard to buy at the destination.

## Gap review — point out what's obviously missing

The core behavior: whether you built the list or the traveler handed you a draft,
**review it against the essentials below and name the omissions explicitly** —
don't silently fill them in, and don't assume "they'll remember." Surface each
gap so the traveler decides, e.g. "Your list has no plug adapter — Japan uses
Type A but your last trip note mentions Type G gear; add an adapter."

Commonly forgotten, worth an explicit check every time:

- **Plug adapter matching the destination's socket type** (name the type, e.g.
  Type A/C/G) — the single most-forgotten item — and a voltage check for any
  appliance that isn't dual-voltage.
- **Chargers** — phone, and especially laptop/camera chargers left behind.
- **Prescription medication** — enough supply, in original labelled packaging
  (some countries require it), plus a copy of the prescription.
- **Travel documents** — passport (with the ≥6-month validity the
  advance-application gate checked), visa/authorization printout or
  confirmation, insurance details, driver's licence + IDP if renting a car.
- **Season/activity mismatch** — flagging when the list doesn't match the
  forecast or the planned activities (no rain gear for a wet-season trip; no
  swimwear when the itinerary has a beach day).
- **Carry-on liquid limit** violations when the trip is cabin-bag-only.

### Essentials checklist to review against

Not every trip needs every line — use it as the cross-check for gaps, then trim
to what fits the trip:

- **Documents & money** — passport, visa/authorization, insurance, booking
  confirmations, driver's licence (+IDP), local cash, cards (check foreign-txn
  fees / notify bank), digital + physical copies of key docs.
- **Health** — prescriptions (+buffer), basic first aid, vaccination certificate
  if required, glasses/contacts, sunscreen, insect repellent where relevant.
- **Electronics** — phone + charger, plug adapter (destination-specific), power
  bank (cabin only), laptop/tablet + chargers, headphones, camera + charger +
  memory cards, e-SIM / local SIM.
- **Clothing** — weather-appropriate layers, rain gear if needed, activity-
  specific gear, enough for the trip length, comfortable walking shoes.
- **Toiletries** — within liquid limits if carry-on-only, plus anything not
  easily bought at the destination.
- **Comfort / misc** — reusable water bottle, daypack, travel locks, laundry
  bag, ear plugs + eye mask (especially for a red-eye flight — ties to the
  flight plan).
