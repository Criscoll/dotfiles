# Rollover — log and daily needle in one pass

The log decides and the daily needle mirrors. Run log-management's rollover first, so each goal
decision is asked once, then copy the day-level decisions onto the stale day's needle. Asking
calendar-management's leftovers questions separately would ask the user the same thing twice.
There is no weekly calendar to close: `Goals for the Week` is retired, and the week's goals,
reflections and carried counts all live in the log.

Pick the branch from the snapshot:

| Snapshot | Branch |
|---|---|
| `week: EXPIRED` | Week rollover |
| `week: NO_LOGS` | Week rollover, from step 4 (there's no expiring week to close) |
| `today_section: STALE` or `MISSING` | Day rollover |

If both apply, run the week branch first. Re-run the snapshot after each branch, because the
next branch must see the state the last one left.

## Week rollover (`week: EXPIRED`)

1. **Close out the log.** Run log-management's `weekly-rollover.md` steps 1–4 on the expiring
   log, including its year archival. As part of step 3, run `today-rollover.md` steps 1–3 on
   the expiring file's stale Today. The per-goal decisions you collect (Done untracked /
   Still relevant / No longer a priority / Outgrew) are the single source of truth, and step 3
   also writes a reflection line into the expiring file's `# Progress` for each carried goal.
2. **Close the expiring Today's needle** using step 2 of Day rollover below.
3. **Run the overlap audit** (`cross-task.md`) now, before new goals are picked. Folds and
   merges should settle before new goals link to tasks. Skip this when the rollover runs
   inside a request rather than `check`, because the audit reads every outline. Suggest
   `/goals overlap` in the close instead.
4. **Pick the new goals.** Run log-management `weekly-rollover.md` steps 5–7: choose the new
   goals, create the new week file, and triage capture.md.
5. **Fill today's needle.** Append the top 1–3 entries of the new Today to today's needle.
   Each must pass the outcome-verb test.

## Day rollover (`today_section: STALE` or `MISSING`, same week)

1. Run log-management's `today-rollover.md` steps 1–3: fold the day into Progress and decide
   each unticked entry. If the section is `MISSING`, skip to step 3 here.
2. **Mirror onto the stale date's needle** (the snapshot fetched it). Never remove anything
   from the original day: its marks are the record.

   | Today entry | Stale date's needle | Today's needle |
   |---|---|---|
   | done or Done untracked | `✅` on the item | — |
   | carried | `❌` on the item | a fresh unmarked copy |
   | dropped | `🚫` on the item | — |

   For needle items that weren't in the stale Today, ask calendar-management's leftovers
   question: `❌` and carry to today, `❌` only, `🚫` (no longer applicable), or leave.
3. Run `today-rollover.md` step 4 to write the fresh Today. Then append its top 1–3 entries to
   today's needle. Append only: the needle may already hold the user's own picks.

When the section is several days stale, close only the needle for the heading's date. That
is where the entries belong. If an in-between day's needle has unmarked content, ask about
it. Never invent entries for days the log didn't record.
