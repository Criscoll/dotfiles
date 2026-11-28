# Goals calendar (`02_Goals`)

Calendar ID: `$GOALS_CALENDAR_ID` (set in `~/.config/agent-scripts/env`, untracked)

A personal goal-tracking calendar. The **event descriptions** carry the content; the summaries
stay fixed. Treat it as a *record*, not a task list — closed days are kept as history and are
never blanked or overwritten.

It carries one active series, the daily `Move the Needle`. The week's goals live in the weekly
log (`log-management`), not here — see "Retired: `Goals for the Week`" below.

## Scope — only act on explicit request

The Goals calendar is **excluded from the routine all-calendars triage sweep**. Only touch it when
the user asks directly — e.g. "set up today's needle", "close out yesterday", "review my needle".
Outside those requests, leave it alone.

Content is the user's. **Never invent, import, or unprompted-suggest goal text.** The populate and
leftover procedures below are the only ways new text enters a description: populating takes its
wording from the weekly log and asks when the pick isn't obvious, and leftovers are confirmed
first. The mechanical normalization pass is process, not content, and doesn't need per-instance
permission.

## Day anchoring — confirm what "today" is first

The machine's `date` can disagree with the user's calendar day (e.g. the box is on UTC while the
user is Australia/Melbourne — `date` shows Sunday when the user's day is already Monday, or a
clock skew). Before any "today" / "yesterday" / "this week" edit, state the date you're treating
as "today" and cross-check it against the user's stated day — the `Move the Needle` instance
dates are a built-in check. Skipping this caused a full triage pass on the wrong day (yesterday
declared "already closed, nothing to carry" when the previous day's needle still had unfinished
items).

## The active series

### `Move the Needle` — the daily layer

- Daily recurring, all-day. Master event ID `$NEEDLE_MASTER_ID` (same env file); instances
  `$NEEDLE_MASTER_ID_YYYYMMDD`.
- Description = the 1–3 things that would move the current week's goals forward that day, as a
  flat `<ul><li>` list (see "Formatting" below).
- Drawn from the weekly log's `# Today` and `# Weekly Goals` success lines (the log is the source
  of truth for the week's goals). Pull across *all* of the week's goals, not just the loudest: a
  goal that never lands on a day is a stalled project, not a low-priority one, and won't get
  caught unless it has at least one slot.
- Every item must pass the outcome-verb test below before it goes on a day — that's what keeps
  this list from turning into a research log.
- The event **summary** itself may carry a trailing mark: `Move the Needle ✅` (a day that
  delivered) or `Move the Needle ❌` (a wasted day). The agent proposes this; the user confirms
  before it is applied.

### Item marks

Each `<li>` can carry one trailing mark, appended and never replacing the wording, because the
needle is the day's honest record.

| Mark | Means | Leftovers |
|---|---|---|
| `✅` | Done | — |
| `❌` | Still applied but didn't get done that day | Offered for another shot |
| `🚫` | No longer applicable: struck, moot, superseded or dropped after it was picked | Closed; never offered or carried |

`❌` and `🚫` stay separate because one mark for both makes the leftovers step offer dead items
for a retry, and makes a changed plan look like a wasted day. Use `🚫` when the log or an outline
shows the item as moot (a decision cancelled or deferred the work), when the user drops it, or
when it is rerouted off the needle (for example to capture.md). Use `❌` only for an item that was
still live and didn't get done.

### Retired: `Goals for the Week`

Retired 2026-10-26. It was a write-only copy of the log's `# Weekly Goals`, re-sorted into
Closed-/Open-Ended sections, and kept the week's goals in two places that had to be synced by hand
at every rollover. The log is now the only record of the week's goals.

- **Never populate, normalise, roll over, mark or otherwise write** a `Goals for the Week`
  instance.
- The recurring master (retired weekly) still runs to the end of 2026 and keeps
  producing empty instances. Ignore them. Never modify the master; ending the recurrence is the
  user's call, not an agent's.
- Instances up to 2026-W44 are the historical record, in the old format: `Closed-Ended:` and
  `Open-Ended:` sections, inline `Reflection:` lines, `(carried Nx)` tags. Read them if asked.
  Never edit them.
- The two things only this series had now live in the log: the per-goal reflection and the
  carried count are written at week close (`log-management`'s `weekly-rollover.md`, step 3).

### Dormant: `Goals for the Month (<Month>)`

Monthly goals were kept as **one-off all-day events** titled e.g. `Goals for the Month (May)`
through May 2026, then discontinued. This is not a recurring series. Leave existing ones as-is;
don't create new ones and don't maintain a monthly (or quarterly/yearly) layer unless the user
explicitly revives it.

## Formatting — always real HTML bullets

Google Calendar's description field renders **real `<ul><li>` bullet lists**, not literal `- `
dash characters — a hand-typed dash just shows up as a hyphen glyph, not an indented bullet.
Author the HTML directly when writing a description. A `Move the Needle` day is a flat list:
`<ul><li>item</li><li>item</li></ul>`.

This is the current convention — `calendar-update --description` stores exactly what's sent, so
plain `- ` dashes render as plain dashes, not bullets.

### Format normalization — always first, before any content edit

The user often edits the needle from their phone, which mangles the formatting: literal `- `
dashes instead of `<ul><li>` bullets, lowercase item starts, stray spaces, uneven blank lines.
**Before any other content step on a `Move the Needle` instance (populate, leftovers, marks), run
a mechanical normalization pass on that day's description.** Do the same for any other day the
request focuses on, including the target day of a leftovers carry.

Allowed fixes (mechanical only — never touch meaning):

- Convert literal `- ` (or `* `, `•`) dash lines into real `<ul><li>` items.
- Capitalise the first letter of each item; leave the rest of the wording alone.
- Collapse repeated spaces, trim leading/trailing whitespace on lines, remove empty list items
  and stray doubled `<br>`/blank lines.
- Normalise mark placement so `✅`/`❌`/`🚫` sits at the end of its item line (fix spacing around
  the mark, don't add or remove marks).

Forbidden during normalization: rewording, reordering, adding/removing items, changing any
`✅`/`❌`/`🚫` mark. If a structural fix would require guessing at meaning (e.g. a merged line could be
two items), ask the user.

If the description is already clean, skip silently — no `calendar-update` call, no commentary.
When normalization did change something, say in one line what was fixed before proceeding to
the actual request.

## Outcome-verb test — does a real thing exist after?

Before an item goes on a `Move the Needle` day, ask: *does something concrete exist afterward
that didn't exist before* — a message sent, a booking made, a decision recorded, a deposit paid?
If the honest answer is "I'll know more" or "I'll have a plan," it fails the test and needs to be
made more concrete before it's added.

This exists because of a standing pattern the user has flagged (see the "Fake Productivity"
reminder on the 03_Reminders calendar): research, notes, and information-gathering feel productive but
produce nothing, and that's exactly what this system is meant to catch. Watch for verbs that let
something sound done while staying vague — `follow up`, `look into`, `research`, `figure out`,
`establish`, `explore` — and reword to the concrete version underneath:

| Vague | Concrete |
|---|---|
| Follow up with HR on the Relocation | Message HR asking for a decision date on the relocation timeline |
| Establish key dates for relocation deliverables | Write down the 3-5 hard relocation deadlines (visa, notice period, lease end) |

This applies when *picking* items too, not just rewording existing ones — a `Move the Needle` day
whose item is "research flights" hasn't earned its slot; "send Sam 2-3 flight options and ask for
a pick by Sunday" has.

## Reading and writing descriptions

- `calendar-get --full <id> --calendar <goals-id>` returns the description **with Google's
  rich-text HTML** — `<br>`, `<ul>`, `<li>`, `<span>`, `&nbsp;`. Read through it.
- `calendar-update --description` **replaces the entire field.** Always `calendar-get --full`
  first, keep the existing content verbatim, and only append marks / add carried items.
- **Preserve the user's structure with a minimal touch**: don't reorder items, don't reword. The
  one exception is the mechanical format-normalization pass above, which always runs first on the
  focused day. Beyond that, only append `✅`/`❌`/`🚫` marks and add items.
- Never modify the recurring masters (the needle master and
  the retired weekly master, which have no `_YYYYMMDD` suffix) — only dated instances.

## Procedures

### Populate today's `Move the Needle` (on request)

1. Read the current week's log, `00_Weekly_Logs/<ISO-year>-W<ISO-week>.md` in the scribbles
   workbench (resolve the week with log-management's Melbourne-time command). If the latest log
   isn't this week's, the week has expired: say so and stop, because log-management's weekly
   rollover comes first.
2. `calendar-get --full` today's `Move the Needle` instance. **Normalize its formatting first**
   (see Format normalization above) if needed.
3. Pick the 1–3 items that today's effort should advance. The log's `# Today` entries are the
   first candidates; draw on the `# Weekly Goals` success lines for any goal that has no slot yet
   this week. Check each against the outcome-verb test before adding it. If the choice isn't
   obvious, ask the user rather than guessing.
4. If the needle already has content, append — don't replace.
5. Write the picked items as a flat `<ul><li>` list, keeping the wording from the log.

### End-of-day `Move the Needle` leftovers (on request)

1. `calendar-get --full` the day's instance.
2. For each unmarked `<li>` item, propose marking it `❌` (it didn't get done), or `🚫` when the
   log or an outline shows it is no longer applicable. Also ask whether already-`❌` items get
   another shot — the user often treats `❌` as "didn't get done, retry" rather than "closed".
   Items already marked `🚫` are closed: don't offer or carry them. Apply on confirmation.
3. Copy the confirmed items — **fresh, unmarked** — into the target day's `Move the Needle`
   description. The target is the **next day** by default; honor a specific day the user names
   (e.g. "move the Stopover items to tomorrow").
4. **Never remove leftovers from the original day.** Its `❌` items stay as the record that the
   task wasn't done when it was supposed to be; the fresh copies in the target day are the retry.
   Only append marks and carried copies — the original description is never trimmed.

### Propose a day summary mark (on request)

A `Move the Needle` summary can take a trailing `✅` or `❌`. Suggest one based on how the
description's items resolved, state your reasoning, and only apply it via
`calendar-update --summary` after the user confirms. Never set it unprompted.

## What not to do

- Don't fold the Goals calendar into routine triage — explicit requests only.
- Don't write to `Goals for the Week` instances (see "Retired" above).
- Don't blank or overwrite past instances; they are the historical record.
- Don't modify the recurring masters.
- Don't invent, import, or unprompted-suggest goal content.
- Don't write plain `- ` dashes for new content — use real `<ul><li>` bullets (see Formatting).
- Don't reorder items or reword existing content. The sole exception: the mechanical
  format-normalization pass, which runs first on the focused day before any other content edit.
