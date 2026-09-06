# Goals calendar (`05. Goals`)

Calendar ID: `d7e8d2283058b1cf4501917e8a924a8d623fbcc595f5e7f1abc80cd88d823997@group.calendar.google.com`

A personal goal-tracking calendar. The **event descriptions** carry the content; the summaries
stay fixed. Treat it as a *record*, not a task list — closed days and weeks are kept as history
and are never blanked or overwritten.

## Scope — only act on explicit request

The Goals calendar is **excluded from the routine all-calendars triage sweep**. Only touch it when
the user asks directly — e.g. "roll over the week", "set up today's needle", "review my goals",
"close out yesterday". Outside those requests, leave it alone.

Content is the user's. **Never invent, import, or unprompted-suggest goal text.** The rollover and
leftover procedures below have confirm-first steps — those are the only ways new text enters a
description, and always with the user's say-so. The mechanical bits introduced below (carry-count
tags, the rollover's holistic question) are process, not content, and don't need per-instance
permission — the wording that fills them in still does.

## Day anchoring — confirm what "today" is first

The machine's `date` can disagree with the user's calendar day (e.g. the box is on UTC while the
user is Australia/Melbourne — `date` shows Sunday when the user's day is already Monday, or a
clock skew). Before any "today" / "yesterday" / "this week" edit, state the date you're treating
as "today" and cross-check it against the user's stated day — the `Move the Needle` instance
dates are a built-in check. Skipping this caused a full triage pass on the wrong day (yesterday
declared "already closed, nothing to carry" when the previous day's needle still had unfinished
items).

## The two active series

### `Goals for the Week` — the planning layer

- Weekly recurring, **Monday → Monday** (a 7-day all-day block; end date is exclusive). Recurs
  through end of 2026. Master event ID `12k1buhgem5sguhl882be01b7d`; instances are
  `12k1buhgem5sguhl882be01b7d_YYYYMMDD` where the date is that week's **Monday**.
- Description is split into two headed sections, `Closed-Ended:` and `Open-Ended:` — see
  "Closed-Ended vs Open-Ended" below for what goes in each and how each is structured.
- The daily `Move the Needle` list is drawn from here.

### `Move the Needle` — the daily layer

- Daily recurring, all-day. Master event ID `46gvt7r9isdp1kvv0bgve3ju3o`; instances
  `46gvt7r9isdp1kvv0bgve3ju3o_YYYYMMDD`.
- Description = the 1–3 things that would move the current week's goals forward that day, as a
  flat `<ul><li>` list (see "Formatting" below).
- Pull from **both** Closed-Ended and Open-Ended across the week — an Open-Ended goal with no day
  anywhere in the week is a stalled project, not a low-priority one, and won't get caught unless
  it has at least one slot.
- Every item must pass the outcome-verb test below before it goes on a day — that's what keeps
  this list from turning into a research log.
- The event **summary** itself may carry a trailing mark: `Move the Needle ✅` (a day that
  delivered) or `Move the Needle ❌` (a wasted day). The agent proposes this; the user confirms
  before it is applied.

### Dormant: `Goals for the Month (<Month>)`

Monthly goals were kept as **one-off all-day events** titled e.g. `Goals for the Month (May)`
through May 2026, then discontinued. This is not a recurring series. Leave existing ones as-is;
don't create new ones and don't maintain a monthly (or quarterly/yearly) layer unless the user
explicitly revives it.

## Closed-Ended vs Open-Ended

**Closed-Ended** — has a definitive done state (pay a bill, book a ticket, have a conversation).
Flat `<ul><li>` list, one item per line. Marked `✅`/`❌` on the item itself.

**Open-Ended** — no natural finish line (engagement planning, a house move, a trip itinerary). Each
item is a top-level `<li>` containing a **nested** `<ul>` with:

- The concrete action(s) for this cycle — this is the floor, not a ceiling: the smallest real
  thing that has to happen for the week to count as progress, not an exhaustive plan. Label it
  `Bare minimum:` when there's more than one action or the scope could be read multiple ways;
  leave it unlabelled when there's a single obvious action (e.g. just "Decide X or Y").
- `Reflection:` — left blank when the week starts, filled in at rollover with what tangibly
  happened (see "Reflection goes inline" below).

No separate "Bonus" slot — if the week exceeds the bare minimum, say so in the Reflection line
instead of tracking stretch goals as their own element.

Example structure (content is illustrative, not live):
```html
Open-Ended:<br><ul><li>Engagement Planning<ul><li>Decide on proposing during the November trip, or book it as a standalone activity in Sydney</li><li>Reflection:</li></ul></li></ul><ul><li>Holiday Itinerary Planning<ul><li>Bare minimum: Taipei day-by-day plan drafted, tickets booked for anything needing advance booking; Alishan day-by-day plan drafted, tickets booked (e.g. sunrise train)</li><li>Reflection:</li></ul></li></ul>
```

## Formatting — always real HTML bullets

Google Calendar's description field renders **real `<ul><li>` bullet lists**, not literal `- `
dash characters — a hand-typed dash just shows up as a hyphen glyph, not an indented bullet.
Author the HTML directly when writing a description:

- Flat list (Closed-Ended, `Move the Needle` days): `<ul><li>item</li><li>item</li></ul>`
- Nested list (Open-Ended): `<ul><li>Goal name<ul><li>sub-item</li><li>sub-item</li></ul></li></ul>`
- Section headers (`Closed-Ended:`, `Open-Ended:`) stay as plain text followed by `<br>` — not
  wrapped in a list themselves.

This is the current convention — `calendar-update --description` stores exactly what's sent, so
plain `- ` dashes render as plain dashes, not bullets.

## Outcome-verb test — does a real thing exist after?

Before an item goes on the Closed-Ended list or a `Move the Needle` day, ask: *does something
concrete exist afterward that didn't exist before* — a message sent, a booking made, a decision
recorded, a deposit paid? If the honest answer is "I'll know more" or "I'll have a plan," it fails
the test and needs to be made more concrete before it's added.

This exists because of a standing pattern the user has flagged (see the "Fake Productivity"
reminder on the Capture calendar): research, notes, and information-gathering feel productive but
produce nothing, and that's exactly what this system is meant to catch. Watch for verbs that let
something sound done while staying vague — `follow up`, `look into`, `research`, `figure out`,
`establish`, `explore` — and reword to the concrete version underneath:

| Vague | Concrete |
|---|---|
| Follow up with HR BP on the HK Move | Message HR BP asking for a decision date on the HK move timeline |
| Establish key dates for HK move deliverables | Write down the 3-5 hard HK move deadlines (visa, notice period, lease end) |

This applies when *picking* items too, not just rewording existing ones — a `Move the Needle` day
whose item is "research flights" hasn't earned its slot; "send Mimi 2-3 flight options and ask for
a pick by Sunday" has.

## Reflection goes inline, not in a separate section

Each Open-Ended item carries its own `Reflection:` line nested under it — not a standalone
"Reflection" block elsewhere in the description. Inline keeps what-was-planned and
what-actually-happened next to each other instead of requiring a scroll to cross-reference.

At weekly rollover, don't fill the Reflection line with just "done" or "not done" — answer the
holistic question honestly: *what tangible thing exists now that didn't a week ago?* "Spent time
on it" or "looked into options" is not a filled Reflection line — it's the fake-productivity
pattern the reminder warns about, just relocated into this calendar.

## Carry-forward staleness tag for Open-Ended items

If an Open-Ended item's bare minimum wasn't met and it carries into the next week, append a count
to the item's own line (not the Reflection line): `Engagement Planning (carried 1x)`, then
`(carried 2x)`, and so on. This makes drift visible — without it, an item silently carried for
months looks identical to one carried once, which is how open-ended goals go stale unnoticed.
Drop the suffix once a cycle's bare minimum is actually met.

## Reading and writing descriptions

- `calendar-get --full <id> --calendar <goals-id>` returns the description **with Google's
  rich-text HTML** — `<br>`, `<ul>`, `<li>`, `<span>`, `&nbsp;`. Read through it.
- `calendar-update --description` **replaces the entire field.** Always `calendar-get --full`
  first, keep the existing content verbatim, and only append marks / add carried items.
- **Preserve the user's structure with a minimal touch**: keep the `Closed-Ended:`/`Open-Ended:`
  headings, keep nested lists nested, don't reorder items, don't reflow. Only append `✅`/`❌`
  marks, fill in `Reflection:` lines, and carry items across.
- Never modify the recurring masters (`12k1buhgem5sguhl882be01b7d`,
  `46gvt7r9isdp1kvv0bgve3ju3o` with no `_YYYYMMDD` suffix) — only dated instances.

## Procedures

### Populate today's `Move the Needle` (on request)

1. `calendar-get --full` the current `Goals for the Week` instance (the one whose Monday starts
   the current week).
2. Pick the 1–3 items that today's effort should advance — draw from **both** Closed-Ended and
   Open-Ended (an Open-Ended item's bare-minimum sub-action counts). Check each against the
   outcome-verb test before adding it. If the choice isn't obvious, ask the user rather than
   guessing.
3. `calendar-get --full` today's `Move the Needle` instance. If it already has content, append —
   don't replace.
4. Write the picked items as a flat `<ul><li>` list, keeping the wording from the weekly list.

### Weekly rollover (on request, typically Monday)

1. `calendar-get --full` the **closing** week's instance (last Monday's).
2. For each unmarked Closed-Ended item, propose `✅` or `❌` and apply the marks the user confirms.
3. For each Open-Ended item, ask the holistic question — *what tangible thing exists now that
   didn't a week ago?* — and write the honest answer into that item's `Reflection:` line as a
   sentence, not a done/not-done label. If the bare minimum wasn't met, the item will carry (see
   next step).
4. `calendar-get --full` the **new** week's instance (this Monday's).
5. Copy every unfinished Closed-Ended item (anything without `✅`) across unchanged. For each
   Open-Ended item whose bare minimum wasn't met, carry the goal name tagged `(carried Nx)` and
   set a **new** bare minimum for the coming week — don't just repeat last week's unmet one
   verbatim, since it already didn't happen. Ask the user if the new bare minimum isn't obvious.
6. Write both descriptions back. The closing week stays as a permanent record — never delete its
   content.

### Sync dailies into the weekly (on request)

The normal feed is weekly → daily; this is the inverse and only happens when asked.

1. `calendar-get --full` the week's `Goals for the Week` instance (the Monday that starts the
   week).
2. Read the week's `Move the Needle` instances that have content.
3. Merge each item into the weekly description — wording verbatim, as `<li>` items. For an
   Open-Ended item, merge into that goal's nested sub-list, not the top-level list. Keep existing
   `✅`/`❌` marks and `Reflection:` text intact (day marks and week marks are separate records —
   don't strip or invent them). Skip items already present.
4. Write the weekly back. Daily needles stay untouched.

### End-of-day `Move the Needle` leftovers (on request)

1. `calendar-get --full` the day's instance.
2. For each unmarked `<li>` item, propose marking it `❌` (it didn't get done). Also ask whether
   already-`❌` items get another shot — the user often treats `❌` as "didn't get done, retry"
   rather than "closed". Apply on confirmation.
3. Copy the confirmed items — **fresh, unmarked** — into the target day's `Move the Needle`
   description. The target is the **next day** by default; honor a specific day the user names
   (e.g. "move the Alishan items to tomorrow").
4. **Never remove leftovers from the original day.** Its `❌` items stay as the record that the
   task wasn't done when it was supposed to be; the fresh copies in the target day are the retry.
   Only append marks and carried copies — the original description is never trimmed.

### Propose a day / week summary mark (on request)

`Move the Needle` and `Goals for the Week` summaries can take a trailing `✅` or `❌`. Suggest one
based on how the description's items resolved, state your reasoning, and only apply it via
`calendar-update --summary` after the user confirms. Never set it unprompted.

## What not to do

- Don't fold the Goals calendar into routine triage — explicit requests only.
- Don't blank or overwrite past instances; they are the historical record.
- Don't modify the recurring masters.
- Don't invent, import, or unprompted-suggest goal content.
- Don't write plain `- ` dashes for new content — use real `<ul><li>` bullets (see Formatting).
- Don't reorder items or reflow existing structure.
- Don't add a "Bonus"/stretch slot to Open-Ended items — mention stretch progress in the
  Reflection line instead.
