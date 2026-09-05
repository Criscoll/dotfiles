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
description, and always with the user's say-so.

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
- Description = a `- ` bulleted list of the week's goals, grouped into blank-line-separated blocks
  by life area (e.g. HK move, wedding, finance). Items pick up a trailing `✅` (done) or `❌`
  (missed) through the week.
- The daily `Move the Needle` list is drawn from here.

### `Move the Needle` — the daily layer

- Daily recurring, all-day. Master event ID `46gvt7r9isdp1kvv0bgve3ju3o`; instances
  `46gvt7r9isdp1kvv0bgve3ju3o_YYYYMMDD`.
- Description = the 1–3 things that would move the current week's goals forward that day, as a `- `
  list, items marked `✅` / `❌`.
- The event **summary** itself may carry a trailing mark: `Move the Needle ✅` (a day that
  delivered) or `Move the Needle ❌` (a wasted day). The agent proposes this; the user confirms
  before it is applied.

### Dormant: `Goals for the Month (<Month>)`

Monthly goals were kept as **one-off all-day events** titled e.g. `Goals for the Month (May)`
through May 2026, then discontinued. This is not a recurring series. Leave existing ones as-is;
don't create new ones and don't maintain a monthly (or quarterly/yearly) layer unless the user
explicitly revives it.

## Reading and writing descriptions

- `calendar-get --full <id> --calendar <goals-id>` returns the description **with Google's
  rich-text HTML** — `<br>`, `<span>`, `&nbsp;`. Read through it.
- `calendar-update --description` **replaces the entire field.** Always `calendar-get --full`
  first, keep the existing content verbatim, and only append marks / add carried items.
- When you write a description back, send **plain text with real newlines** — don't hand-author
  `<br>`.
- **Preserve the user's structure with a minimal touch**: `- ` prefix on every line, keep the
  blank-line grouping between life areas, don't reorder items, don't add headings, don't reflow.
  Only append `✅`/`❌` marks and carry items across.
- Never modify the recurring masters (`12k1buhgem5sguhl882be01b7d`,
  `46gvt7r9isdp1kvv0bgve3ju3o` with no `_YYYYMMDD` suffix) — only dated instances.

## Procedures

### Populate today's `Move the Needle` (on request)

1. `calendar-get --full` the current `Goals for the Week` instance (the one whose Monday starts
   the current week).
2. Pick the 1–3 goal items that today's effort should advance. If the choice isn't obvious, ask
   the user rather than guessing.
3. `calendar-get --full` today's `Move the Needle` instance. If it already has content, append —
   don't replace.
4. Write the picked items as a `- ` list, keeping the wording from the weekly list.

### Weekly rollover (on request, typically Monday)

1. `calendar-get --full` the **closing** week's instance (last Monday's).
2. For each unmarked item, propose `✅` or `❌` to the user and apply the marks they confirm.
   Leave genuinely-still-open items unmarked if the user says so.
3. `calendar-get --full` the **new** week's instance (this Monday's).
4. Copy every unfinished item (anything without `✅`) into the new week's description, preserving
   its life-area grouping. Don't copy completed items.
5. Write both descriptions back. The closing week stays as a permanent record — never delete its
   content.

### Sync dailies into the weekly (on request)

The normal feed is weekly → daily; this is the inverse and only happens when asked.

1. `calendar-get --full` the week's `Goals for the Week` instance (the Monday that starts the
   week).
2. Read the week's `Move the Needle` instances that have content.
3. Merge each item into the weekly description — wording verbatim, keeping the user's
   blank-line grouping and any existing `✅`/`❌` marks (day marks and week marks are separate
   records — don't strip or invent them). Skip items already present; drop stray empty `- `
   bullets.
4. Write the weekly back. Daily needles stay untouched.

### End-of-day `Move the Needle` leftovers (on request)

1. `calendar-get --full` the day's instance.
2. For each unmarked `- ` item, propose marking it `❌` (it didn't get done). Also ask whether
   already-`❌` items get another shot — the user often treats `❌` as "didn't get done, retry"
   rather than "closed". Apply on confirmation.
3. Copy the confirmed items — **fresh, unmarked** — into the target day's `Move the Needle`
   description. The target is the **next day** by default; honor a specific day the user names
   (e.g. "move the Alishan items to tomorrow").
4. **Never remove leftovers from the original day.** Its `❌` items stay as the record that the
   task wasn't done when it was supposed to be; the fresh copies in the target day are the
   retry. Only append marks and carried copies — the original description is never trimmed.

### Propose a day / week summary mark (on request)

`Move the Needle` and `Goals for the Week` summaries can take a trailing `✅` or `❌`. Suggest one
based on how the description's items resolved, state your reasoning, and only apply it via
`calendar-update --summary` after the user confirms. Never set it unprompted.

## What not to do

- Don't fold the Goals calendar into routine triage — explicit requests only.
- Don't blank or overwrite past instances; they are the historical record.
- Don't modify the recurring masters.
- Don't invent, import, or unprompted-suggest goal content.
- Don't reformat: no reordering, no headings, no reflow. Keep the `- ` prefix on every line and
  the user's blank-line groups intact.
