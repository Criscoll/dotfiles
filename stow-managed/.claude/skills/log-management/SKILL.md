---
name: log-management
description: >-
  Apply the weekly-log conventions for the scribbles workbench — ISO-week log
  files with a dated Today section, Weekly Goals (each with checkable success lines),
  and Progress, plus task-link syntax, the capture.md inbox, and day/week
  rollover. Auto-invoke BEFORE creating or editing a week's log file, adding or
  ticking Today entries or weekly goals, checking whether the current day's or
  week's section is stale, rolling over to a new day or week, or triaging
  capture.md. Not for the 02_Goals calendar (that is calendar-management).
  Trigger phrases: "weekly log", "week log", "00_Weekly_Logs", "capture.md",
  "weekly goals", "today section", "log today", "success line", "new week",
  "roll over the week", "rollover", "week file", "ISO week", "week progress",
  "carry forward the week", "what happened this week", "log-management".
disable-model-invocation: false
---

# Weekly Log Conventions

The weekly logs directory is at `~/Repos/scribbles/02_Workbench/00_Weekly_Logs/`.
It sits alongside (not inside) the task lifecycle stages — it tracks *what this
week and today are for*, while `01_Ideas/` → `04_Archived/` (see the
`task-management` skill) tracks the *lifecycle of individual tasks*. The linked
task's own `outline.md` stays the source of truth for that task's detail; the
log never copies it.

```
02_Workbench/
    00_Weekly_Logs/
        capture.md          — persistent un-triaged inbox (see below)
        2026-W43.md          — flat, current year
        2026-W44.md          — current week
        2025/                — past years, archived after year-end
            2025-W40.md
    01_Ideas/  02_Backlog/  03_Active/  04_Archived/
```

If `00_Weekly_Logs/` doesn't exist yet, create it (and `capture.md`, empty)
before writing the first week file.

---

## Dates — Melbourne time, always

Week files are named `<ISO-year>-W<ISO-week>.md` (e.g. `2026-W44.md`); the
format sorts lexicographically in chronological order. Resolve "this week" and
"today" with the command below before touching any file — never guess, and never
use `date.today()` or the shell `date`: the box runs on UTC while the user is in
Melbourne, so from Monday morning until ~10–11am the box still says Sunday and
would pick last week (and the wrong Today date). Python rather than
`date +%G-W%V` because BSD `date` on macOS (a read-only pull target) lacks
`%V`/`%G`.

```bash
python3 - <<'EOF'
import datetime as d, zoneinfo as z
t = d.datetime.now(z.ZoneInfo("Australia/Melbourne")).date()  # for last/next week, shift t by ±7 days; the Today heading always uses the real t
y, w, _ = t.isocalendar()
mon = t - d.timedelta(days=t.weekday())
sun = mon + d.timedelta(days=6)
print(f"{y}-W{w:02d}")                          # file name
print(f"# {y}-W{w:02d} ({mon:%b %d} – {sun:%b %d})")  # week heading
print(f"# Today ({t:%a %b %d})")                # Today heading
EOF
```

---

## Week File Structure

```markdown
# 2026-W44 (Oct 26 – Nov 01)

# Today (Mon Oct 26)

- [x] Email Bank A, Broker B and Lender C to call off the settlement
- [ ] Book the Stopover hotel for Thu 19 – Sun 22 Nov

# Weekly Goals

- [x] Renew car registration
- [ ] [Home Refinance BankA to LenderC](../03_Active/Home_Refinance_Mortgage_BankA_to_LenderC/outline.md)
    - [x] Emails sent to Bank A, Broker B and Lender C to call off the settlement
    - [ ] Bank A's written confirmation of the cancellation received (by Tue 27 Oct)
- [ ] [Overseas Trip](../03_Active/Travel_Overseas_Trip_2026_2027/outline.md)
    - Stopover hotel booked and rail tickets purchased
- [ ] ~Investigate flaky CI~

# Progress

Sun Oct 25 — Drafted the Stopover skeleton; refinance emails still unsent.
```

Section order is Today → Weekly Goals → Progress: Today is what gets read and
edited daily, so it sits at the top. Within Today and Weekly Goals, order
completed items first, active in the middle, cancelled (`~struck~`) last — the
same convention as `task-management`.

### `# Weekly Goals` — what this week must deliver

One checkbox is one task (or one standalone outcome) for this week. The list
answers "what do I want done by Sunday", so each goal spells out exactly when it
counts as done.

- **Pass the outcome test.** After the goal is done, something concrete must
  exist that didn't before — a message sent, a booking made, a decision written
  into the outline, a payment made. "I'll know more" or "I'll have a plan" fails.
  Vague verbs let a goal sound done while staying fuzzy (`research`, `look
  into`, `follow up`, `figure out`, `explore`); rewrite to the concrete result
  underneath:

  | Vague | Concrete |
  |---|---|
  | Look into backup options for the NAS | Backup target and replication model decided and written into the outline |
  | Follow up with the photographer | Reply sent accepting or declining the 3-hour quote |

- **Success line** — a sub-item under a goal stating one outcome that counts as
  done. Make it clear, succinct and objective: one short line naming an end
  state anyone could check yes/no ("Stopover hotel booking finalised"), not the
  steps to get there. No label prefix — its position under the goal already says
  what it is — and no how-to or hedging. Keep a deadline only when it matters,
  as a short trailing clause ("by Tue 27 Oct"). A goal can have several.
- **Task-linked goal** — `[Task Name](relative/path/to/outline.md)` as the
  checkbox text (the `[]()` form so `gf`/`gx` in nvim jumps to the outline; path
  relative to the week file, e.g. `../03_Active/Project_Foo/outline.md`). It
  requires at least one success line. The link only says *which* task; the
  success lines say what *this week* is for, which matters because tasks carry
  across weeks while the focus changes. A task appears once per week, however
  many success lines it has — list it again and the duplicate link lines bury
  the actual outcomes.
- **One line or several.** With a single success line, write it as a plain
  bullet: the goal's own checkbox is its tick, and a box under a box would be a
  duplicate pair. With two or more, give each line its own checkbox so partial
  progress shows. The goal's box then mirrors its lines — ticked exactly when
  every line is ticked, never earlier, which is what keeps "done" unambiguous. A
  `~struck~` line is ignored when deciding.
- **General goal** — plain text with no link, for something that matters this
  week but doesn't warrant a task directory. The text itself is the outcome;
  add a success line only if the text alone leaves "done" arguable. If it needs
  several, it has outgrown the log: promote it via the `task-management` skill
  and turn it into a link.
- **No further nesting.** Goals have one level of success lines and nothing
  beneath them. Success lines are outcomes, not a copy of the task's outline
  (which drifts); steps belong in Today as they come up.
- **Ticking.** Tick a success line only when its outcome exists, never because a
  Today entry for it was ticked. A goal being done this week does not mean the
  task is done — the task's own outline owns that.
- **Carrying over.** The link persists across weeks but the success lines are
  rewritten for the new week's focus: carry an unmet line only if it still
  stands, add new ones, and leave ticked ones behind. If an unmet line didn't
  happen, ask whether it still stands (see rollover).

### `# Today (<Day Mon DD>)` — today's focus

A flat checklist of what today is for. The date in the heading (Melbourne time,
from the command above) records which day the entries belong to; if it differs
from today's date, the section is stale and needs `references/today-rollover.md`
before anything else is added.

- **Specific enough to start without thinking** — "Email Bank A to cancel the
  29 Oct settlement", not "deal with refinance". Same outcome test as goals.
- **Related to the weekly goals, loosely.** Each entry should be a step toward,
  prep for, or unblocker of a goal; no formal link is needed. If an entry serves
  no goal, say so in one line and let the user decide — it is either a missing
  goal or a distraction, and the user is the one who can tell which.
- **Flat, no sub-bullets**, and no fixed count — but if the list is too long to
  finish in a day, say so rather than appending silently.
- When ticking a Today entry satisfies a success line, point it out and tick the
  line (and the goal, if that was its last open line) if the user agrees.

### `# Progress` — scratch space

Free prose, no required structure; don't impose checkbox format here. It is
also where a finished day's Today entries are folded as one dated line when the
day rolls over, so the week keeps a record while Today stays small. At week close it also
takes one `Reflection — <Task> (carried Nx): …` line per carried goal (see
`references/weekly-rollover.md`).

---

## Populating — Default to AskUserQuestion

When creating a new week's log, rolling over, or making a mid-week addition with
more than one plausible candidate, drive it with `AskUserQuestion` rounds
(discover candidate tasks, batch multi-select questions, then batch again to fix
each goal's success line) rather than asking the user to freehand list everything.
Recognising candidates is much faster than recalling them. The calendar is not
consulted unless the user asks. Load `references/askuserquestion-population.md`
for the procedure.

---

## capture.md — The Un-triaged Inbox

`00_Weekly_Logs/capture.md` is a single persistent file (not per-week) for items
the user raises that aren't dedicated tasks yet and haven't been decided as
this-week priorities either. Append freely, one item per line, no required
format — it's a scratchpad, not a tracked list.

Don't triage it opportunistically on every mention — the audit pass happens at
weekly rollover, so items get a deliberate, batched review rather than being
silently promoted or dropped mid-conversation.

---

## Rollover — Day and Week

Two clocks, two procedures. Check both before adding anything to a log:

1. Is the latest file in `00_Weekly_Logs/` (excluding `capture.md`) the current
   ISO week? If not, the week has expired — load `references/weekly-rollover.md`.
   It covers closing the old week, per-goal migration (never silently carry or
   drop an incomplete goal), a reflection line for each carried goal, the
   task-link check, and the capture.md audit.
2. Does the `# Today` heading's date equal today's date? If not, the day has
   expired — load `references/today-rollover.md`.

---

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`).
Do not guess their contents — read them.

- **references/weekly-rollover.md** — load when: the latest week file isn't the
  current ISO week, creating a new week file, migrating incomplete goals from an
  expired week (including old-format `# Outline` files), checking task links, or
  triaging `capture.md`.
- **references/today-rollover.md** — load when: the `# Today` heading's date
  isn't today, starting a new day's focus, or folding a finished day into
  `# Progress`.
- **references/askuserquestion-population.md** — load when: choosing a week's
  goals, fixing their success lines, populating Today, or any time you'd
  otherwise ask the user to freehand list tasks/items.
