---
name: goals
description: >-
  Helper for the week's goals across the scribbles weekly log, the daily Move
  the Needle on the 02_Goals calendar, and the task outline.md files. The
  weekly log is the source of truth; the needle mirrors its Today entries, and
  needle items with no Today entry are routed to Today or capture.md. By
  default it does one targeted job, such as updating today's needle, ticking a
  goal or finding the task a goal belongs to, and reads only what that job
  needs. Explicit-only: run /goals <request> (in pi, /skill:goals <request>).
  /goals check runs the full sweep (rollover, a reconcile of the log, needle
  and outlines and the cross-task implication sweep, then confirm and apply);
  /goals overlap runs the cross-task overlap audit.
disable-model-invocation: true
---

# Goals — helper for the log, daily needle and outlines

The weekly log is the source of truth for the week's goals. The daily `Move the Needle` event
on the `02_Goals` calendar mirrors its Today entries; this skill calls that calendar the Goals
calendar and never works with any other calendar. The weekly `Goals for the Week` series is
retired, so there is no weekly calendar copy to keep in sync. The task `outline.md` files hold
each task's step detail. The three drift apart, and this skill brings the other two back in
line with the log. It is a thin orchestrator. The three sibling skills own their conventions,
and you load them at runtime. This skill owns only what crosses systems: the item mapping, the
trust rules, the order of the combined rollover, and the cross-task implication and overlap
analysis. Don't restate sibling rules from memory or invent your own variants. Two copies of a
rule drift, and the sibling file is the one the user maintains.

| Concern | Owner |
|---|---|
| Week file structure, success lines, outcome test, `# Today`, log day/week rollover, week-close reflections, capture.md | `log-management` |
| Move the Needle model, completion marks, format normalization, outcome-verb test, minimal-touch writes | `calendar-management` (`references/goals-calendar.md`) |
| outline.md structure, todo ordering, parent/sub-task rules, lifecycle moves | `task-management` |
| Cross-system mapping, trust rules, combined rollover order, implication sweep, overlap audit | `goals` (this skill) |

Invoking `/goals` is the explicit request that both siblings require. calendar-management
keeps the Goals calendar out of routine triage and touches it only when asked.
log-management doesn't consult the Goals calendar "unless the user asks". The user has asked
by running this skill. Read the needle freely, and write to it once the user confirms.

## Modes

Read `$ARGUMENTS`. In pi, it comes from the `User:` line appended after this skill.

- **(empty)**: ask what the user needs, and run nothing until they answer. Even the snapshot
  waits, because the answer decides what's worth reading.
- **`check`**: the full sweep (see "Full sweep" below). It reads every outline and every
  sibling file, which costs tens of thousands of tokens, so it runs only when asked for by
  name.
- **`overlap`**: the overlap audit on its own (see "Overlap audit" below). Combined with
  `check`, the full sweep includes it.
- **Anything else**: a request. Do just that job (see "Requests" below). This is the
  everyday use of the skill: updating today's needle, ticking a goal, finding the task a
  goal belongs to, or answering a question about this week's goals.

`check` and `overlap` are modes only when the arguments are nothing but those words, in any
order or case. "check whether the Alishan booking is on today's needle" is a request, not
the full sweep. If it's unclear which was meant, ask. Guessing `check` spends the tokens that
request mode exists to save.

## Setup

1. Run the snapshot. It is read-only, costs about 2k tokens and replaces about six separate
   calls. It also computes the Melbourne dates and instance IDs, so they can't drift:
   ```bash
   ~/.claude/skills/goals/scripts/snapshot
   ```
   A non-zero exit means a needle fetch failed, and that block shows `FETCH FAILED:
   <stderr>`. If the error looks like auth, run calendar-management's precheck
   (`~/bin/agent_scripts/gmail-labels`), then stop and tell the user. Working against a
   missing side would report every item as a discrepancy.
2. State the Melbourne date you're treating as "today" (the snapshot's `today:` line). This
   is calendar-management's day-anchoring rule: a wrong "today" closes the wrong needle.
3. Load the sibling conventions the run needs. Read the files rather than working from
   memory, because their rules change. A request loads only the rows for the work it does,
   and the full sweep loads them all:

   | Work | Files under `~/.claude/skills/` |
   |---|---|
   | Edit the log or capture.md | `log-management/SKILL.md` |
   | Write to the needle | `calendar-management/references/goals-calendar.md` |
   | Edit an outline | `task-management/SKILL.md` |
   | `check` | all of the above, plus `calendar-management/SKILL.md`, `calendar-management/references/operations.md` and `google-workspace/calendar.md` |

   Reading the snapshot or looking up a task needs none of them. log-management's references
   (`weekly-rollover.md`, `today-rollover.md`, `askuserquestion-population.md`) live in
   `~/.claude/skills/log-management/references/`. Load each on log-management's own
   conditions. calendar-management's `${CLAUDE_SKILL_DIR}/../../google-workspace/calendar.md`
   is the same file as the `google-workspace/calendar.md` above.

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
- **NEEDLE blocks** hold the raw HTML descriptions of today's needle and, when Today is
  stale, the stale date's needle. Each header names its role and event ID. A needle with no
  `Description:` line is empty.

## Requests (the default)

A request does one job and reads only what that job needs. Most cost the snapshot plus one
or two files.

1. **Setup.** Run Setup steps 1–2, then step 3 for only the work this request does.
2. **Rollover due?** If the snapshot shows `week: EXPIRED` or `NO_LOGS`, or `today_section:
   STALE` or `MISSING`, say so in one line. Run the rollover (`references/rollover.md`) only
   when the user asks for it, or when the request writes to an out-of-date log, because
   log-management won't add to a stale week or day.
3. **Do the job**, touching only the items it names. The trust rules apply to those items:
   - A completion goes onto that item's matches on the other sides: its log line, its needle
     item and its linked outline. Look at those only, not the rest of the week.
   - A new goal, or a change to what a goal says, goes into the log as a log-management
     mid-week addition. The needle is a day's picks, not a copy of the goals, so it changes
     only if the new goal is picked for today.
   - Load `references/reconcile.md` before any needle write. It holds the item map and the
     write sequence.
4. **Finding a task.** Match the request against the snapshot's active outline paths and
   backlog names first. If that isn't enough, `rg -l` the key terms across
   `02_Workbench/03_Active/` and `02_Backlog/`. Open the outlines of only the best one to
   three candidates and read their Brief to confirm. A lookup never reads every outline.
5. **Confirm and apply** as in the full sweep's steps 7–9. Nothing is written without
   confirmation except format normalization, and the needle is written last.

A request never runs the implication sweep, the overlap audit or a whole-week reconcile. If
the items it touched hint at wider drift (an outline that contradicts other goals, say),
mention it in one line and suggest `/goals check`.

## Full sweep (`check`)

Run Setup in full, loading every sibling file in step 3.

1. **Rollover gate.** Load `references/rollover.md` when any of these show:
   - `week: EXPIRED` or `NO_LOGS`;
   - `today_section: STALE` or `MISSING`.

   Run the matching branch, re-run the snapshot, then continue from step 2 on the fresh
   state.
2. **Format normalization.** Run calendar-management's mechanical pass on today's needle.
   That skill already authorises it without per-item confirmation. Say in one line what
   changed.
3. **Read every outline** listed under `TASKS: active outlines`, in full. Respect each
   outline's `# Notes` read-on-demand rule: open a `01_Notes/` file only when its summary
   bears on a specific discrepancy, never as a bulk read.
4. **Reconcile** the log, needle and outlines using `references/reconcile.md`.
5. **Cross-task.** Run the implication sweep. Also run the overlap audit if this sweep
   rolled the week over or `overlap` was passed too. Both are in `references/cross-task.md`.
6. **Report.** Give a numbered list grouped by discrepancy kind. Each entry names the sides
   involved, the proposed fix and its direction (e.g. `log → needle`).
7. **Confirm.** Ask in batched `AskUserQuestion` rounds: up to 4 questions per call, as many
   rounds as needed, with the proposed fix first as "(Recommended)".
8. **Apply** only what was confirmed, in this order: outlines, then log and capture.md, then
   the needle. The needle goes last because `calendar-update --description` replaces the
   whole field. Run `calendar-get --full` immediately before each write and edit that fresh
   copy, so earlier writes in this run (or a phone edit in the meantime) aren't overwritten.
9. **Close.** Give one line per side (log and capture.md, needle, outlines) saying what
   changed, plus anything deferred or left as-is.

## Overlap audit (`overlap`)

1. Run Setup steps 1–2. In step 3, load `task-management/SKILL.md`, plus
   `log-management/SKILL.md` if a fix will touch links in the log.
2. Read every active outline in full, with the same `# Notes` rule as the full sweep's step 3.
3. Run the overlap audit in `references/cross-task.md`, then confirm, apply and close as in
   the full sweep's steps 7–9.

## Trust rules (apply everywhere)

- **The log is the source of truth.** The proposed fix for any difference corrects the needle
  to match the log, because the log is where outcomes are written with care. Goals enter the
  log only through log-management: week rollover, mid-week additions and capture.md triage.
  So a needle item typed on the phone is never written into the log's goals. It is offered as
  a Today entry, or sent to capture.md when it is really a new goal (`reconcile.md` kind 6).
  Every fix is still confirmed.
- **Completions propagate; content changes are asked.** A completion recorded anywhere
  (outline `[x]`, log `[x]`/`[X]`, needle `✅`) is *proposed* for the matching items on the
  other sides. Adding, removing, rewording or rescoping anything is always a question. This
  deliberately reverses the old "never edit the outline to match the log" rule: outlines can
  now take ticks and edits, but only after confirmation.
- **Granularity guard.** A log success line is an outcome; outline items are steps. A ticked
  line proposes ticking only the outline steps it fully covers. If an open step sits under it,
  report a conflict and ask whether the log tick is premature or the outline is stale. Don't
  tick either side. Example: log `[X] Emails sent to NAB, MSA and Up…` against outline
  `[ ] Email Up`.
- **Equivalent wording is not a discrepancy.** "Finalise Alishan Hotel Booking" and "Alishan
  hotel booking finalised" are the same item. Only differences in meaning or scope count.
  Never reword for style: calendar-management forbids rewording, and the wording is the
  user's.
- **Stale needle items get a mark and are never removed.** `❌` for an item that was live and
  didn't get done, `🚫` for one that no longer applies (struck, moot, superseded or dropped).
  The needle is an honest record, so you only ever append marks.
- **Nothing is written without confirmation,** except calendar-management's mechanical format
  normalization.

## Mark mapping

| Meaning | Log | Needle | Outline |
|---|---|---|---|
| done | `[x]` (also `[X]`) | `✅` | `[x]` |
| cancelled/deprioritised | `~struck~` | `🚫` | `~struck~` |
| not done at close | carried | `❌` | stays `[ ]` |
| open | `[ ]` | no mark | `[ ]` |

`🚫` is the needle's "no longer applicable" mark and `❌` its "still live, didn't get done"
mark. Keeping them apart stops the leftovers step offering dead items for a retry. A log line
that is struck always maps to `🚫`; `❌` is for items that were carried or are still open.

Existing logs contain uppercase `[X]`; read it as ticked. Write new ticks as `[x]`, and don't
mass-normalise old ones: the diff noise would hide the real change.

## Boundaries

- No git in `~/Repos/scribbles` (no fetch, pull or commit). The user manages that repo's
  history.
- Never modify the recurring masters (`46gvt7r9isdp1kvv0bgve3ju3o` and the retired weekly
  `12k1buhgem5sguhl882be01b7d`, both with no date suffix). Never blank a past instance: they
  are the historical record.
- Never write to a `Goals for the Week` instance. The series is retired: its empty future
  instances are ignored and the old ones are history.
- Past week logs are snapshots and are never edited, except the close-out of the closing
  week's file that log-management's rollover performs, including its reflection lines.
- Reflection lines are written only at weekly rollover. Mid-week, any answer would be a guess.
- Past days' needles are touched only during day rollover.
- Touch no calendar other than 02_Goals.
- Day summary marks (`Move the Needle ✅`) aren't part of /goals. The user requests them
  through calendar-management.

## Load Reference Files When Relevant

Read these with `cat ~/.claude/skills/goals/references/<file>`. Don't guess their contents.

- **references/rollover.md**: load when a rollover runs. In `check`, that's whenever the
  snapshot shows `week: EXPIRED` or `NO_LOGS`, or `today_section: STALE` or `MISSING`. In a
  request, it's only when the user asks for one or the request writes to an out-of-date log.
- **references/reconcile.md**: load at full-sweep step 4, and in a request before any needle
  write.
- **references/cross-task.md**: load at full-sweep step 5 and for `overlap`. In `check`,
  also load it alongside `rollover.md` for a week rollover, because the overlap audit runs
  inside that branch.
