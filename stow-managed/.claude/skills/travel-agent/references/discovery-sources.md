# Discovery Sources — finding non-generic things to do

Load this when researching things to do for a stop. Where a city guide surfaces
the same top-10 every traveler sees, these sources reach the offbeat and
neighborhood-specific layer underneath it — a generic list is a decision-fatigue
trap of its own (more options to sift, less signal per option).

## Search order

1. **Vault first.** Defer to the "Search the vault first" rule in
   `itinerary-research.md` — a prior trip may already hold notes for this
   destination.
2. **Wikivoyage destination/district pages.** The See/Do sections are broken
   out by district, which maps directly onto geographic clustering — read the
   district that matches the day's area focus rather than the whole city page.
3. **Atlas Obscura** — see the crawl pattern below.
4. **Reddit**, via the wrapper scripts documented in
   `stow-managed/.claude/skills/web-crawl/reddit.md`:
   `~/bin/agent_scripts/reddit-search <query> [--subreddit SUB]` and
   `reddit-thread <url>`. Search the city/country subreddit plus r/travel.
5. **Neighborhood-specific `web-search` queries** — "<neighborhood> guide",
   "best coffee in <neighborhood>, <city>", not a city-wide "best things to do
   in <city>" search, which just re-surfaces the generic top-10.
6. **Local newsletters, Substack, and city-culture sites** — often the
   freshest and most specific layer, at the cost of needing a bit more
   judgment on relevance.

## Atlas Obscura crawl pattern

Use the `web-crawl` skill's `webcrawl` binary for all of this — never fetch
these pages with WebFetch/curl directly.

- **City guide:** `https://www.atlasobscura.com/things-to-do/<city>-<country>`
  (e.g. `taipei-taiwan`) shows a count ("36 Cool, Hidden, and Unusual Things to
  Do in Taipei") and a "Cool Places to Eat & Drink" section. The full list is
  at `…/things-to-do/<city>-<country>/places`; the country-level guide is at
  `…/things-to-do/<country>`. Each entry is a one-line blurb linking to
  `/places/<slug>`.
- **Place page:** `webcrawl https://www.atlasobscura.com/places/<slug> --raw`
  returns `## About`, `## Know Before You Go` (practical access tips), a
  `Published` date, a map block (street address followed by a `lat, lng` line,
  e.g. `25.052178, 121.516384`), and `Nearby Places`.
- **Filter before crawling place pages.** Check each list-page blurb against
  the trip's taste block first, and only spend a crawl call on shortlisted
  candidates — the list page is cheap to scan, the place page isn't free.
- **Use the coordinates for clustering** — feed them into the day's geographic
  grouping the same way any other anchor's location would be.
- **Check for staleness.** Entries can be old (e.g. published 2018) — treat
  every Atlas Obscura hit as a candidate, not a confirmed booking, and verify
  current open status per the Research-Source Discipline rules in
  `itinerary-research.md` before it lands on a day.

## Reading reviews

Prefer the most recent reviews over the highest-rated ones — a venue can
decline or close between the two. Read the 1-star reviews alongside the
5-star ones; a cluster of recent 1-stars citing the same complaint is more
informative than an average score. Weight local reviewers over tourists when
the platform makes that distinguishable (local language, local-sounding
history of reviews).

## Anchor-radiating research

Once an anchor is chosen for a day, research its immediate area next —
Atlas Obscura's "Nearby Places" on that anchor's page, or a
"<neighborhood> guide" search — to fill that day's float pool, instead of
re-searching the whole city. This keeps the day geographically tight and
reuses the anchor choice as the seed for the rest of the day's options.

## Candidate record

While researching, keep a running record per candidate so shortlists (in
Decision-light planning, `itinerary-research.md`) can be built directly from
it:

- Name, area, coordinates (if known)
- Anchor-eligible (fixed time/limited availability) or float (flexible)
- Which taste-block item it matches
- Source and date found

## Sources

- theeverygirl.com/travel-itinerary-planning-tips/ — anchor formula
- nomadicmatt.com/travel-blogs/how-to-deal-with-choice/ — choice overload
- muchbetteradventures.com/magazine/decision-fatigue-travel-planning/ —
  restricting options to beat decision fatigue
