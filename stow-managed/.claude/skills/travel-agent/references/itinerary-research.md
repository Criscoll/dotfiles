# Itinerary Planning and Pre-Trip Research

Depth for the research → itinerary half of the skill: the advance-application
gate (visas and anything else with a lead time), research-source discipline,
ground transport between stops, building the day-by-day plan, and the
on-the-ground budget. `SKILL.md` holds the short rules and the output formats;
this file holds the reasoning and the checklists behind them.

## Advance Applications & Bookings — the lead-time gate

The failure this section exists to prevent: dates and flights get locked in,
then a visa that takes six weeks (or a passport two months from expiry) turns
out to invalidate the whole plan. Applications with lead times must be surfaced
**before** the plan hardens around them, not discovered afterward.

**Derive requirements from destination(s) + the traveler's passport/nationality
— never from memory.** Visa and entry rules are nationality-specific and change
often. Verify against an authoritative source (the destination government's
immigration site, or the IATA Travel Centre) via `web-search`, rather than
stating a rule from training data that may be stale or wrong for this passport.

**Don't forget transit points.** A layover in a third country can require a
transit visa even when the traveler never clears immigration — check every
country a candidate itinerary routes *through*, not just origin and destination.
This couples back to flight routing: a cheaper routing via a country requiring a
transit visa may not actually be cheaper once the visa cost and hassle are in.

Things that carry a lead time and belong in this gate:

- **Full visas / e-visas / visa-on-arrival** — note processing time (often
  weeks), whether biometrics or an in-person appointment is required, the fee,
  and **whether exact entry dates must be fixed to apply** — if so, the visa
  couples directly to Date Planning and can't be deferred until after dates
  settle.
- **Travel authorizations short of a visa** — ESTA (US), and ETA-style schemes
  (UK ETA, EU ETIAS once live, Australia ETA/eVisitor, etc.). Fast to obtain but
  still mandatory before departure and easy to forget.
- **Passport validity** — many countries require **≥6 months' validity beyond
  the return date** plus blank pages. Flag a passport close to expiry as its own
  blocking item: passport renewal has a long lead time and gates everything else.
- **Vaccinations / prophylaxis** — some are a mandatory entry condition (e.g. a
  yellow-fever certificate for certain routes), and some need to start weeks
  ahead. Check destination health requirements.
- **Travel insurance** — sometimes a precondition of the visa itself, not just a
  good idea; check whether the visa requires proof of cover.
- **International Driving Permit (IDP)** — needed before departure if the trip
  involves renting/driving; can't be obtained abroad.
- **Permits and hard-to-get bookings** — national park / hike / trek permits,
  and popular timed-entry attractions, tours, or restaurants that sell out or
  book out weeks-to-months ahead. (See "must-book-ahead" under research below —
  these belong in this gate too, since they're lead-time-bound.)

**Order by lead time and let the longest one set the earliest feasible
departure.** A visa that takes six weeks means dates inside the next six weeks
aren't real options — feed that back into Date Planning rather than sweeping
prices for dates that can't happen.

**How to raise it.** When anchoring to the task file, check whether `outline.md`
records the status of entry requirements. **If the outline is silent on visas,
treat that as unresolved, not as "the traveler has it handled"** — a silent
outline is the exact case where a forgotten visa slips through. Surface each
unresolved item as a blocking `[ ] Do:` entry in the outline, with the
requirement, its lead time, and the deadline relative to the target dates (e.g.
"apply by 2026-10-01 for a Nov departure"). Ask the traveler directly rather
than assuming; a one-line confirmation ("visa already sorted") closes it.

## Taste Profile — the Brief block

Every source and shortlist in this file needs a filter to check candidates
against — otherwise "fit stated priorities" has nothing concrete to fit
against. Capture a standard taste-profile block in the trip's `outline.md`
Brief, inside the existing batched trip-shape intake from `SKILL.md` Workflow
step 2 (no extra round of questions):

```
**Taste profile**
- Loves: …            - Skip: …
- Energy/pace: …      - Food: …
- Must-dos: …
```

Record it once per trip and reuse it on every later pass — don't re-ask if
it's already in the Brief. This block is what "fit stated priorities, don't
paste a generic top-10" (below) and the anchor shortlists (Decision-light
planning) actually check candidates against.

## Research-Source Discipline

The flight half is careful about verifying claims against observed behavior;
apply the same rigor to activity research.

- **Recency.** Opening hours, prices, closures, and whether a place still exists
  all drift. Prefer sources from the last year or two, and **confirm hours,
  price, and open/closed status on the official site** before committing an
  activity to a specific day. An attraction that's closed for renovation, or
  permanently shut, sitting on the itinerary is a silent failure that a stale
  blog won't reveal.
- **Fit stated priorities, don't paste a generic top-10.** The outline records
  pace and priorities (e.g. "active, nature over shopping"). Filter every
  suggestion against them, and when a famous attraction conflicts with the
  stated priority, say so rather than including it by default because it's
  well-known.
- **Events, festivals, and public holidays in the window.** Check the dates for
  festivals and holidays — both to *catch* (enrichment) and to *avoid* (crowds,
  price spikes, and closures — many businesses and government-run sites shut on
  national holidays). This overlaps Date Planning's window-narrowing, but here
  it also drives which day an activity is placed on.
- **Search the vault first.** Before researching a destination from scratch,
  search `01_Notes/06_Travel/` (per the `notes` skill) — prior trips may already
  hold visa notes, city guides, or logistics that don't need re-deriving.
- **Tag must-book-ahead items as you find them.** Anything that sells out or
  needs reservation weeks ahead (timed museum entry, permits, popular
  restaurants, guided tours, event tickets) gets flagged the moment it surfaces
  in research and lifted into the advance-application gate above — not left to be
  discovered when the day-by-day plan is being finalized, which is too late to
  book.

## Ground Transport Between Stops

Within-trip movement is an itinerary driver, not an afterthought — the flight
half covers getting to and from the trip and multi-city air legs, but trains,
buses, ferries, and car legs between stops shape the day plan just as much.

- **Transit time eats the day count.** A half- or full-day inter-city train or
  drive is not a sightseeing day — subtract it from the stop's usable days and
  feed that back into "day count per stop." Three nights in a city reached by a
  four-hour afternoon train is really two-and-a-bit usable days.
- **Passes vs point-to-point — do the math.** Rail/transit passes (e.g. a
  regional rail pass) only pay off above a usage threshold. Compute it against
  the actual planned legs rather than assuming a pass is cheaper because it's
  marketed that way.
- **Base-and-day-trip vs relocate.** Moving hotels every two nights carries real
  overhead (checkout, luggage drag, re-settling). Sometimes day-tripping out
  from one base beats relocating; weigh it explicitly.
- **Booking windows for ground legs.** Some trains (high-speed, sleeper) open
  booking a fixed window ahead and sell out or jump in price — note the open
  date the same way a flight's price trend matters.
- **First/last mile at odd hours.** Airport↔city transfer options thin out late
  at night — a 01:00 arrival may have no train and only a taxi. Check this
  against the actual flight arrival time before assuming a cheap transfer.

## Decision-light planning

The traveler's decision budget is the scarce resource, not the agent's
research effort — every question asked costs the traveler decision energy, so
spend that budget on the choices that actually matter (fixed-time
commitments) and default the rest.

- **The traveler chooses anchors only.** An anchor is something with a fixed
  time or limited availability (reservation, timed entry, tour, day trip
  needing transport) — see the anchor definition below. For each open anchor
  slot, present **at most 3 candidates**, one marked **(Recommended)** with a
  one-line reason tied to the taste block, and batch these through
  `AskUserQuestion` (up to 4 questions per call, as many rounds as needed,
  grouped by stop).
- **Must-dos from the taste block are pre-placed, not asked.** If the Brief's
  taste profile already names a must-do, put it on the itinerary directly —
  don't turn a settled preference back into a question.
- **Fillers are defaulted, not asked up front.** Float-pool options, meal
  spots, and transit mode get auto-picked with a one-line reason each and
  shown in the draft itinerary; the traveler vetoes what doesn't fit, rather
  than being asked to choose each one in advance. This is deliberately
  asymmetric with anchors — the traveler keeps control over the commitments
  that are expensive to change later (a booked timed-entry slot), while
  low-stakes reversible choices (which of three nearby cafés) don't need a
  question at all.
- **Record settled choices in a "Decisions recorded" list** in the outline (or
  the research note) so they aren't re-litigated on a later pass — the same
  pattern flight preferences already use.

## Building the Day-by-Day Itinerary

- **Geographic clustering.** Group each day's activities by area/neighborhood to
  cut backtracking, and sequence stops to minimize criss-crossing the city —
  order by geography, not by personal ranking.
- **Realistic pacing — anchors plus a float pool.** An **anchor** is something
  with a fixed time or limited availability: a reservation, timed entry, guided
  tour, or a day trip that needs booked transport. Cap it at **≤2 anchors per
  day** — beyond that, travel time between them (a first-class cost, the way
  layover time is treated on the flight side) eats the day. Everything else —
  3–5 nearby, unscheduled options per area — goes into a per-area **float
  pool**: explicitly optional, not a to-do list, and a source of picks when
  plans slip (closure, weather, low energy) rather than a second fixed
  schedule.
- **Arrival- and departure-day realism — reconcile against the actual flight
  times.** Build day 1 against the real arrival time: a red-eye or late arrival
  makes day 1 rest/logistics only, and a long-haul arrival brings jet lag that
  degrades the next day too. The final day ends at airport-check-in time, not
  midnight. This is the seam where the itinerary and the chosen flights must
  meet — don't plan N full days when arrival and departure quietly consume two
  half-days.
- **Opening-days cross-check.** Once the calendar is fixed, verify each activity
  against the specific weekday it lands on (many attractions close a fixed day —
  Mondays are common) and against the season (lifts, blossoms, sailing, monsoon
  closures). Move or swap anything landing on a closed day. This is the
  itinerary analogue of the hidden-overnight-sector check on the flight side: a
  plan that looks complete but puts a museum on its closed day is a real defect.
- **Buffer and rest.** On trips beyond about five days, leave slack: one
  zero-anchor rest day, placed around day 4 or right after the hardest day,
  plus general slack against back-to-back packed days that degrade the trip and
  leave no room for weather, spillover, or a spontaneous find.
- **Weather-driven alternatives.** For any outdoor anchor, note an indoor
  fallback for a bad-weather day — especially in a wet or shoulder season where
  a washout is likely.

### Output format — day-by-day

Present the plan as dated day blocks, each headed with its date, weekday, base
city, and area focus, then the day's anchors and transit notes. Flag booked-ahead
and closed-day risks inline:

```
Day 1 — Sat 15 Nov — Taipei (arrival day)
- Arrive TPE 20:15 (see flights). Airport→hotel ~45 min. Evening only:
  check in, dinner near hotel. No anchor activity — late arrival.

Day 2 — Sun 16 Nov — Taipei (old-city cluster)
- Anchor: National Palace Museum — open Sun; timed entry, BOOK AHEAD (~half day).
- Then: Shilin walk + night market (evening). Transit: museum→Shilin ~25 min metro.
- Float (optional, nearby): Shilin Ciyou Temple, Yangmingshan tea house, one more
  night-market stall row — pick on the day, not a fixed commitment.
- Note: check [holiday] closures.
```

Underneath the day blocks, give a compact one-row-per-day overview for scanning
— the same "detail blocks then compact table" shape the flight results use:

```
| Day | Date       | Base   | Area / focus      | Anchor(s)              | Booked ahead? | Notes                 |
|-----|------------|--------|-------------------|------------------------|---------------|-----------------------|
| 1   | Sat 15 Nov | Taipei | Arrival           | —                      | —             | Land 20:15, rest      |
| 2   | Sun 16 Nov | Taipei | Old-city cluster  | Palace Museum          | Yes (timed)   | Shilin night market   |
```

## On-the-Ground Budget

Deal-Finding prices flights, hotels, and leave days — but a trip costs more than
its bookable portion. Estimate daily on-the-ground spend (food, local transport,
entry fees, activities/tours) as a rough per-day figure × days, so the total
handed to the traveler is honest rather than just the airfare-plus-hotel slice.
Pull a realistic tier (budget / mid / high) from research for the specific
destination rather than guessing, state the currency, and label it an estimate —
it's for deciding, not for reconciling to the cent.
