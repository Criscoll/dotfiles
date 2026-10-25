---
name: goals
description: >-
  Reconcile the week's goals across the scribbles weekly log, the 05. Goals
  calendar (Goals for the Week / Move the Needle) and the task outline.md
  files. It rolls the log and calendar over together in one pass, reports
  discrepancies, cross-task implications and overlaps, and applies only the
  fixes the user confirms. Explicit-only: run /goals [check] [overlap] (in pi,
  /skill:goals [check] [overlap]). check reports without writing anything;
  overlap forces the full cross-task overlap audit mid-week.
disable-model-invocation: true
---

# Goals — reconcile log, calendar and outlines

The week's goals live in three places that drift apart: the weekly log, the `05. Goals`
calendar, and the task `outline.md` files. This skill is a thin orchestrator. The three
sibling skills own their conventions, and you load them at runtime. This skill owns only what
crosses systems: the item mapping, the trust rules, the order of the combined rollover, and
the cross-task implication and overlap analysis. Don't restate sibling rules from memory or
invent your own variants. Two copies of a rule drift, and the sibling file is the one the user
maintains.

| Concern | Owner |
|---|---|
| Week file structure, success lines, outcome test, `# Today`, log day/week rollover, capture.md | `log-management` |
| Completion marks, Goals for the Week / Move the Needle model, format normalization, outcome-verb test, minimal-touch writes | `calendar-management` (`references/goals-calendar.md`) |
| outline.md structure, todo ordering, parent/sub-task rules, lifecycle moves | `task-management` |
| Cross-system mapping, trust rules, combined rollover order, implication sweep, overlap audit | `goals` (this skill) |

Invoking `/goals` is the explicit request that both siblings require. calendar-management
keeps 05. Goals out of routine triage and touches it only when asked. log-management doesn't
consult the calendar "unless the user asks". The user has asked by running this skill. Read
the 05. Goals calendar freely, and write to it once the user confirms.

## Modes

Read the mode words from `$ARGUMENTS`. In pi, they come from the `User:` line appended after
this skill. Parse them generously: words combine, and order and case don't matter. If a word
is neither mode, ask what was meant before running.

- **(empty)**: the full run. Roll over if one is due, then reconcile, run the implication
  sweep, confirm with the user and apply.
- **`check`**: report only. Write nothing anywhere: no format normalization, no rollover, no
  `calendar-update` and no file edits. Still run every analysis, so the report is what a full
  run would propose.
- **`overlap`**: also run the full overlap audit, which otherwise runs only at weekly
  rollover.

## Setup

1. Run the snapshot. It is read-only and replaces about six separate calls. It also computes
   the Melbourne dates and instance IDs, so they can't drift:
   ```bash
   ~/.claude/skills/goals/scripts/snapshot
   ```
   A non-zero exit means a calendar fetch failed, and that block shows `FETCH FAILED:
   <stderr>`. If the error looks like auth, run calendar-management's precheck
   (`~/bin/agent_scripts/gmail-labels`), then stop and tell the user. Reconciling against a
   missing side would report every item as a discrepancy.
2. Load the sibling conventions. Read the files, because their rules change:
   ```bash
   cat ~/.claude/skills/log-management/SKILL.md
   cat ~/.claude/skills/calendar-management/SKILL.md
   cat ~/.claude/skills/calendar-management/references/goals-calendar.md
   cat ~/.claude/skills/calendar-management/references/operations.md
   cat ~/.claude/skills/google-workspace/calendar.md
   cat ~/.claude/skills/task-management/SKILL.md
   ```
   log-management's references (`weekly-rollover.md`, `today-rollover.md`,
   `askuserquestion-population.md`) live in `~/.claude/skills/log-management/references/`.
   Load each on log-management's own conditions. calendar-management's
   `${CLAUDE_SKILL_DIR}/../../google-workspace/calendar.md` is the same file as the
   `google-workspace/calendar.md` above.
3. State the Melbourne date you're treating as "today" (the snapshot's `today:` line). This
   is calendar-management's day-anchoring rule: a wrong "today" closes the wrong needle.

### Reading the snapshot

- **`focus_file`** is the week being reconciled. That's the current week's log, or the latest
  older log when the week has expired. A log for a later week is never the focus. `ahead:`
  lists any such file, because the user sometimes rolls the log over early.
- **`week:`** is `CURRENT`, `EXPIRED (latest …, current …)` or `NO_LOGS`.
- **`today_section:`** is one of:
  - `CURRENT`, `STALE (…)` or `MISSING`.
  - `AHEAD (…)`: Today was written in advance for a later day. Leave it alone and skip
    Today ↔ needle this run.
  - `UNRESOLVED (…)`: the heading is malformed. Report it and ask.
- **`calendar_rollover:`**
  - `PENDING (closing …; new …)`: the log has already moved past the closing week, either
    through an ahead file or because this week's file exists, but that week's Goals for the
    Week still has unmarked Closed-Ended items or blank `Reflection:` lines.
  - `none` or `n/a (…)`: nothing to do.
  - `UNKNOWN`: the fetch failed.
- **CALENDAR blocks** hold the raw HTML descriptions. Each header names its role(s) and event
  ID. A needle with no `Description:` line is empty.

## Run sequence

1. **Rollover gate.** Load `references/rollover.md` when any of these show:
   - `week: EXPIRED` or `NO_LOGS`;
   - `today_section: STALE` or `MISSING`;
   - `calendar_rollover: PENDING`.

   Run the matching branch, re-run the snapshot, then continue from step 2 on the fresh
   state. In `check` mode, roll nothing. Report which rollover is due and the questions and
   marks it would propose. For `calendar_rollover: PENDING`, that includes the closing week's
   mark proposals, which is where last week's leftovers show up. Then reconcile the focus
   week read-only as it stands.
2. **Format normalization.** Run calendar-management's mechanical pass on the focus week's
   Goals for the Week instance. That skill already authorises it without per-item
   confirmation. Say in one line what changed. In `check` mode, say what would change and
   write nothing.
3. **Read every outline** listed under `TASKS: active outlines`, in full. Respect each
   outline's `# Notes` read-on-demand rule: open a `01_Notes/` file only when its summary
   bears on a specific discrepancy, never as a bulk read.
4. **Reconcile** the log, calendar and outlines using `references/reconcile.md`.
5. **Cross-task.** Run the implication sweep every run. Also run the overlap audit if this
   run rolled the week over or `overlap` was passed. Both are in `references/cross-task.md`.
6. **Report.** Give a numbered list grouped by discrepancy kind. Each entry names the sides
   involved, the proposed fix and its direction (e.g. `log → calendar`).
7. **Confirm.** Ask in batched `AskUserQuestion` rounds: up to 4 questions per call, as many
   rounds as needed, with the proposed fix first as "(Recommended)". Skip this in `check`.
8. **Apply** only what was confirmed, in this order: outlines, then log, then calendar. The
   calendar goes last because `calendar-update --description` replaces the whole field. Run
   `calendar-get --full` immediately before each write and edit that fresh copy, so earlier
   writes in this run (or a phone edit in the meantime) aren't overwritten.
9. **Close.** Give one line per side (log, calendar, outlines) saying what changed, plus
   anything deferred or left as-is.

## Trust rules (apply everywhere)

- **The log leads; ask on conflicts.** By default, correct the calendar to match the log,
  because the log is where outcomes are written with care. Calendar-only items are sometimes
  real (typed on the phone, for example), so always ask about those and about mark conflicts
  rather than overwriting them.
- **Completions propagate; content changes are asked.** A completion recorded anywhere
  (outline `[x]`, log `[x]`/`[X]`, calendar `✅`) is *proposed* for the matching items on the
  other two sides. Adding, removing, rewording or rescoping anything is always a question.
  This deliberately reverses the old "never edit the outline to match the log" rule: outlines
  can now take ticks and edits, but only after confirmation.
- **Granularity guard.** A log success line is an outcome; outline items are steps. A ticked
  line proposes ticking only the outline steps it fully covers. If an open step sits under it,
  report a conflict and ask whether the log tick is premature or the outline is stale. Don't
  tick either side. Example: log `[X] Emails sent to NAB, MSA and Up…` against outline
  `[ ] Email Up`.
- **Equivalent wording is not a discrepancy.** "Finalise Alishan Hotel Booking" and "Alishan
  hotel booking finalised" are the same item. Only differences in meaning or scope count.
  Never reword for style: calendar-management forbids rewording, and the wording is the
  user's.
- **Stale calendar items get `❌` and are never removed.** The calendar is an honest record,
  so you only ever append marks.
- **Nothing is written without confirmation,** except calendar-management's mechanical format
  normalization.

## Mark mapping

| Meaning | Log | Calendar | Outline |
|---|---|---|---|
| done | `[x]` (also `[X]`) | `✅` | `[x]` |
| cancelled/deprioritised | `~struck~` | `❌` | `~struck~` |
| not done at close | carried or struck | `❌` | stays `[ ]` |
| open | `[ ]` | no mark | `[ ]` |

Existing logs contain uppercase `[X]`; read it as ticked. Write new ticks as `[x]`, and don't
mass-normalise old ones: the diff noise would hide the real change.

## Boundaries

- No git in `~/Repos/scribbles` (no fetch, pull or commit). The user manages that repo's
  history.
- Never modify the recurring masters (`12k1buhgem5sguhl882be01b7d`,
  `46gvt7r9isdp1kvv0bgve3ju3o` with no date suffix). Never blank a past instance: they are
  the historical record.
- Past week logs are snapshots and are never edited, except the close-out of the closing
  week's file that log-management's rollover performs.
- Fill `Reflection:` lines only at weekly rollover. Mid-week, any answer would be a guess.
- Past days' needles are touched only during day rollover.
- Touch no calendar other than 05. Goals.
- Day and week summary marks (`Move the Needle ✅`, `Goals for the Week ✅`) aren't part of
  /goals. The user requests them through calendar-management.

## Load Reference Files When Relevant

Read these with `cat ~/.claude/skills/goals/references/<file>`. Don't guess their contents.

- **references/rollover.md**: load when the snapshot shows `week: EXPIRED` or `NO_LOGS`,
  `today_section: STALE` or `MISSING`, or `calendar_rollover: PENDING`. Load it in `check`
  mode too, to describe what the rollover would do.
- **references/reconcile.md**: load at run step 4 (every run). Load it earlier, alongside
  `rollover.md`, whenever a rollover runs, because the calendar mirror uses its item map.
- **references/cross-task.md**: load at run step 5 (every run). Load it alongside
  `rollover.md` for a week rollover or calendar catch-up, because the overlap audit runs
  inside those branches.
