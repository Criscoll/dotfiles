# Reconcile — log, needle and outlines

Compare the focus week's log, today's Move the Needle and the active outlines. Find where they
disagree, and turn each disagreement into a question with a proposed fix. Every rule here sits
under the trust rules in `SKILL.md`.

That's the full sweep. A request uses only what its job needs: the map for the items it
touches (§1) and the apply mechanics (§4).

## 1. Build the map

For each goal and success line in the focus log's `# Weekly Goals`:

- **Outline match(es).** Search the linked task's `outline.md` for the steps the line
  covers. If the item obviously belongs to another active outline, search that one instead.

Matching is semantic, not string equality. One line can map to several steps, and several
lines can map to one step. Keep a list of what's unmatched on each side: those become
discrepancies.

Worked example (W43). The HK/Taiwan Travel goal has three success lines:

| Log success line | Outline (`Travel_Hong_Kong_Taiwan_2026_2027/outline.md`) |
|---|---|
| Alishan skeleton for Thu 19 – Sun 22 Nov written… | the Alishan itinerary items |
| Alishan hotel booking finalised | "Try to book better hotel for Alishan…" |
| Taiwan train / bus tickets booked | the transport booking items |

Map the daily layer the same way: `# Today` entries against today's Move the Needle items.
The needle holds the top 1–3 of Today, so a Today entry that isn't on the needle is fine.

## 2. Discrepancy kinds

Each kind lists the fix to propose. The trust rules decide what's proposed and what's asked.

1. **Completion mismatch.** One side is marked done and a matching item elsewhere isn't.
   Propose the mark on the other sides (`[x]` / `✅` / `[x]`), subject to the granularity
   guard. Example: a Today entry is `[x]` but the matching needle item has no mark, so propose
   `✅` on the needle.
2. **Meaning drift.** The same item appears with a different scope, date or target on each
   side. Ask which version is current, with the log's version as the recommended option.
   Then update the other side(s).
3. **Outline contradiction.** A log line or needle item is something the outline shows as
   moot, superseded or cancelled. Propose a strike on the log line, adding `— <reason>`, and
   `❌` on the needle item if there is one. Example: the refinance outline's "Status
   (2026-10-23): Up declined; the refinance is off" makes any live line that assumes the
   refinance proceeds moot.
4. **Outline-only news.** An outline completion, or an open item due this week, changes
   whether a weekly goal is met. Propose ticking the goal or adding a new success line. The
   log is allowed to be a subset of the outlines, so only surface items that affect a goal or
   carry a deadline this week.
5. **Link rot.** A task link in the focus week's log returns 404. Fix the relative path using
   the logic of log-management's `weekly-rollover.md` step 4: search `03_Active/`,
   `02_Backlog/` and `04_Archived/` by task name. If the task was archived, ask before
   treating the goal as live.
6. **Today ↔ needle.**
   - A needle item is missing from Today (often typed on the phone). Never write it into the
     goals. Ask which applies: add it to Today (Recommended when it is a step toward an
     existing goal); send it to capture.md and mark it `❌` on the needle, appending
     `- <item wording> (was: Move the Needle, <date>)`, when it is really a new goal, so the
     next capture.md triage decides; mark it `❌` only; or leave it. An item that already
     carries `✅` or `❌` is a closed record, so leave it alone.
   - Ticks disagree: propagate the completion.
   - Today has entries but the needle is empty: propose 1–3 picks from Today that pass the
     outcome-verb test.

The granularity guard turns some completion mismatches into conflicts. Example: log
`[X] Emails sent to NAB, MSA and Up…` while the refinance outline still has `[ ] Email Up`.
Ask whether the log tick is premature or the outline is stale. Don't propose ticking either
side.

## 3. Question shape

Ask one question per discrepancy, or per cluster of discrepancies that share an answer (e.g.
two log lines the same outline status makes moot). Order the options this way:

1. The proposed fix, labelled "(Recommended)".
2. The alternative direction (e.g. "untick the log" instead of "tick the outline").
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
- **Needle edits** follow goals-calendar.md's minimal touch: only append marks and add carried
  or new items. Never reword or reorder. Every write follows the same sequence:
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
