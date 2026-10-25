# Rollover — log and calendar in one pass

The log decides and the calendar mirrors. Run log-management's rollover first, so each goal
decision is asked once, then copy those decisions onto the calendar. Asking
calendar-management's rollover questions separately would ask the user the same thing twice.

Pick the branch from the snapshot:

| Snapshot | Branch |
|---|---|
| `week: EXPIRED` | Week rollover |
| `week: NO_LOGS` | Week rollover, from step 5 (there's no expiring week to close) |
| `calendar_rollover: PENDING` | Calendar catch-up (the log was already rolled) |
| `today_section: STALE` or `MISSING` | Day rollover |

If several apply, run the week branch (rollover or catch-up) first. Re-run the snapshot
after each branch, because the next branch must see the state the last one left.

## Week rollover (`week: EXPIRED`)

1. **Close out the log.** Run log-management's `weekly-rollover.md` steps 1–4 on the expiring
   log, including its year archival. As part of step 3, run `today-rollover.md` steps 1–3 on
   the expiring file's stale Today. The per-goal decisions you collect (Done untracked /
   Still relevant / No longer a priority / Outgrew) are the single source of truth for both
   systems.
2. **Mirror the decisions onto the closing week's Goals for the Week.** Normalise its format
   first. Use the map from `reconcile.md` to find each item's log line.

   | Calendar item | Mark on the closing week |
   |---|---|
   | Closed-Ended, log line done or Done untracked | `✅` |
   | Closed-Ended, log line Still relevant (carried) | `❌`, plus a fresh unmarked copy into the new week |
   | Closed-Ended, log line No longer a priority | `❌` |
   | Closed-Ended, no log line | ask: `✅` / `❌` / carry |

   For each Open-Ended item, propose its `Reflection:` sentence and confirm the proposals in
   a batch. The sentence answers "what tangible thing exists now that didn't a week ago?",
   drawn from the log's Progress lines, ticked success lines and outline changes. "Spent time
   on it" is not a reflection. A carried Open-Ended goal gets its `(carried Nx)` tag
   incremented on the new week, with a *new* bare minimum taken from the new log's success
   line (step 6). Drop the tag once a week's bare minimum is met.
3. **Close the expiring Today's needle** using step 2 of Day rollover below.
4. **Run the overlap audit** (`cross-task.md`) now, before new goals are picked. Folds and
   merges should settle before new goals link to tasks.
5. **Pick the new goals.** Run log-management `weekly-rollover.md` steps 5–7: choose the new
   goals, create the new week file, and triage capture.md.
6. **Write the new week's Goals for the Week from the new log.** Normalise first. Then merge
   into whatever the user has already typed on the phone; never overwrite it. Example: W44's
   `<b>Closed-Ended</b>:<br>- <br><br> <br><b>Open-Ended</b>:<br> -` normalises to two empty
   headed sections.
   - Classify each goal or success line as Closed-Ended or Open-Ended using `reconcile.md`
     kind 2.
   - Treat phone-typed items that aren't in the new log as calendar-only discrepancies, and
     ask about them.
7. **Fill today's needle.** Append the top 1–3 entries of the new Today to today's needle.
   Each must pass the outcome-verb test.

## Calendar catch-up (`calendar_rollover: PENDING`)

The user rolled the log over with log-management alone, so the decisions exist in the two
log files but the calendar never received them. The snapshot names the `closing` and `new`
weeks, and prints both logs and the closing week's instance.

1. **Rolled early?** If the closing week is still the current week (e.g. the log was rolled
   on Sunday), ask once: close the calendar week now, or leave it until the week ends? Closing
   early marks items that could still get done today. If the answer is "wait", skip the rest
   of this branch and reconcile the focus week as normal.
2. **Infer each decision** from the two log files instead of asking again:

   | Closing log line | Decision |
   |---|---|
   | ticked | done |
   | unticked, with an equivalent line under the same goal in the new file | Still relevant (carried) |
   | struck | No longer a priority |
   | unticked, not struck, absent from the new file | unknown, so ask in one batch: Done untracked / No longer a priority / carry |

   Write a Done-untracked tick into the closing file. That is the close-out log-management's
   rollover performs on the expiring week.
3. **Mirror onto the closing week** exactly as Week rollover step 2: marks, Reflection
   proposals, carried copies and `(carried Nx)` tags.
4. **Close the closing log's last Today needle** if that needle has unmarked items. Use Day
   rollover step 2. An entry counts as carried if it reappears in the new file's Today.
5. **Run the overlap audit** (`cross-task.md`). The new goals are already chosen, but this is
   still the weekly checkpoint. A fold or merge then means fixing links in the new week's log.
6. **Write the new week's Goals for the Week** from the new log, as Week rollover step 6,
   merging into anything typed on the phone.
7. **Fill the needle** as Week rollover step 7, but only if the new file's Today heading is
   today. A Today written ahead for tomorrow (`today_section: AHEAD`) waits for that day's
   run.

## Day rollover (`today_section: STALE` or `MISSING`, same week)

1. Run log-management's `today-rollover.md` steps 1–3: fold the day into Progress and decide
   each unticked entry. If the section is `MISSING`, skip to step 3 here.
2. **Mirror onto the stale date's needle** (the snapshot fetched it). Never remove anything
   from the original day: its marks are the record.

   | Today entry | Stale date's needle | Today's needle |
   |---|---|---|
   | done or Done untracked | `✅` on the item | — |
   | carried | `❌` on the item | a fresh unmarked copy |
   | dropped | `❌` on the item | — |

   For needle items that weren't in the stale Today, ask calendar-management's leftovers
   question: `❌` and carry to today, `❌` only, or leave.
3. Run `today-rollover.md` step 4 to write the fresh Today. Then append its top 1–3 entries to
   today's needle. Append only: the needle may already hold the user's own picks.

When the section is several days stale, close only the needle for the heading's date. That
is where the entries belong. If an in-between day's needle has unmarked content, ask about
it. Never invent entries for days the log didn't record.
