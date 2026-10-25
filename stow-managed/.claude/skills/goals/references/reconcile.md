# Reconcile — the three-way item map

Compare the focus week's log, its Goals for the Week instance, today's Move the Needle and
the active outlines. Find where they disagree, and turn each disagreement into a question
with a proposed fix. Every rule here sits under the trust rules in `SKILL.md`.

## 1. Build the map

For each goal and success line in the focus log's `# Weekly Goals`:

- **Calendar match(es).** Search the focus week's Closed-Ended items and Open-Ended bare
  minimums. An Open-Ended goal name maps to the log goal, and its bare minimum maps to a
  success line.
- **Outline match(es).** Search the linked task's `outline.md` for the steps the line
  covers. If the item obviously belongs to another active outline, search that one instead.

Matching is semantic, not string equality. One line can map to several items, and several
lines can map to one item. Keep a list of what's unmatched on each side: those become
discrepancies.

Worked example (W43). The HK/Taiwan Travel goal has three success lines:

| Log success line | Calendar | Outline (`Travel_Hong_Kong_Taiwan_2026_2027/outline.md`) |
|---|---|---|
| Alishan skeleton for Thu 19 – Sun 22 Nov written… | Open-Ended "Holiday Itinerary Planning" bare minimum | the Alishan itinerary items |
| Alishan hotel booking finalised | Closed-Ended "Finalise Alishan Hotel Booking" | "Try to book better hotel for Alishan…" |
| Taiwan train / bus tickets booked | Closed-Ended "Book Taiwan train / bus tickets ahead of time" | the transport booking items |

Map the daily layer the same way: `# Today` entries against today's Move the Needle items.
The needle holds the top 1–3 of Today, so a Today entry that isn't on the needle is fine.

## 2. Discrepancy kinds

Each kind lists the fix to propose. The trust rules decide what's proposed and what's asked.

1. **Completion mismatch.** One side is marked done and a matching item elsewhere isn't.
   Propose the mark on the other sides (`[x]` / `✅` / `[x]`), subject to the granularity
   guard. Example: the RTM booking is `[X]` in the log but has no mark on the calendar, so
   propose `✅` on the calendar.
2. **Log-only item.** A goal or success line has no calendar match, so add it to the
   calendar. First classify it:
   - **Closed-Ended:** it has a definitive done state. Add it as a flat `<li>`.
   - **Open-Ended:** it has no finish line. Add the goal name as a top-level `<li>`. The
     success line becomes its nested `Bare minimum:`, followed by a blank `Reflection:`.

   Use real `<ul><li>` HTML and keep the log's wording.
3. **Calendar-only item.** A calendar item has no log match. Ask which of these applies:
   - Add it to the log, either as a success line under the matching task goal or as a general
     goal. It must pass the outcome test first.
   - Mark it `❌`.
   - Leave it as-is.
4. **Meaning drift.** The same item appears with a different scope, date or target on each
   side. Ask which version is current, then update the other side(s).
5. **Outline contradiction.** A log or calendar item is something the outline shows as
   moot, superseded or cancelled. Propose `❌` on the calendar, plus a strike on the log line
   if there is one. Example: the calendar's "Up Home refinance: complete the GBG ID check…"
   and "…get the change-of-name ID copies JP-certified…" against the refinance outline's
   "Status (2026-10-23): Up declined; the refinance is off".
6. **Outline-only news.** An outline completion, or an open item due this week, changes
   whether a weekly goal is met. Propose ticking the goal or adding a new success line. The
   log is allowed to be a subset of the outlines, so only surface items that affect a goal or
   carry a deadline this week.
7. **Link rot.** A task link in the focus week's log returns 404. Fix the relative path using
   the logic of log-management's `weekly-rollover.md` step 4: search `03_Active/`,
   `02_Backlog/` and `04_Archived/` by task name. If the task was archived, ask before
   treating the goal as live.
8. **Today ↔ needle.**
   - A needle item is missing from Today: propose adding it to Today, or `❌` on the needle.
   - Ticks disagree: propagate the completion.
   - Today has entries but the needle is empty: propose 1–3 picks from Today that pass the
     outcome-verb test.

The granularity guard turns some completion mismatches into conflicts. Example: log
`[X] Emails sent to NAB, MSA and Up…` while the refinance outline still has `[ ] Email Up`.
Ask whether the log tick is premature or the outline is stale. Don't propose ticking either
side.

## 3. Question shape

Ask one question per discrepancy, or per cluster of discrepancies that share an answer (e.g.
both dead refinance items on the calendar). Order the options this way:

1. The proposed fix, labelled "(Recommended)".
2. The alternative direction (e.g. "untick the log" instead of "tick the calendar").
3. "Leave as-is".

Each option's description must name exactly which side(s) change and the text that will be
written. The user is confirming a write, not an idea.

## 4. Apply mechanics

- **Log edits** follow log-management:
  - Order lists done, then active, then struck.
  - A goal's box mirrors its lines: tick it when the last open line is ticked.
  - Write new ticks as `[x]`.
- **Outline edits** follow task-management:
  - Order lists done, then active, then `~cancelled~`.
  - A parent is ticked only when all its children are.
  - When you strike a line, add a short `— <reason>`.
- **Calendar edits** follow goals-calendar.md's minimal touch: only append marks, add
  carried or new items, and fill Reflection at rollover. Never reword or reorder. Every
  write follows the same sequence:
  1. `calendar-get --full` the instance.
  2. Edit that fresh HTML.
  3. Write it to a temp file. Descriptions contain apostrophes ("Mimi's", "don't") that break
     shell quoting.
  4. Pass it in:
     ```bash
     ~/bin/agent_scripts/calendar-update <instance-id> \
       --calendar d7e8d2283058b1cf4501917e8a924a8d623fbcc595f5e7f1abc80cd88d823997@group.calendar.google.com \
       --description "$(cat /tmp/goals-desc.html)"
     ```
