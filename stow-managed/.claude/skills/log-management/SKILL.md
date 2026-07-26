---
name: log-management
description: >-
  Apply the weekly-log conventions for the scribbles workbench — ISO-week log
  file structure, the Outline/Progress sections, task-linking syntax, the
  capture.md inbox, and the weekly rollover/migration process. Auto-invoke
  BEFORE creating or editing a week's log file, checking whether the current
  week's log exists, rolling over to a new week, or triaging capture.md.
  Trigger phrases: "weekly log", "week log", "00_Weekly_Logs", "capture.md",
  "new week", "roll over the week", "rollover", "week file", "ISO week",
  "log outline", "week progress", "carry forward the week", "what happened
  this week", "log-management".
disable-model-invocation: false
---

# Weekly Log Conventions

The weekly logs directory is at `~/Repos/scribbles/02_Workbench/00_Weekly_Logs/`.
It sits alongside (not inside) the task lifecycle stages — it tracks *intent
per week*, while `01_Ideas/` → `04_Archived/` (see the `task-management` skill)
tracks the *lifecycle of individual tasks*. A week's log is a high-level,
curated view; the linked task's own `outline.md` is always the more granular
and reliable source for that task's actual detail.

```
02_Workbench/
    00_Weekly_Logs/
        capture.md          — persistent un-triaged inbox (see below)
        2026-W27.md          — flat, current year
        2026-W28.md          — current week
        2025/                — past years, archived after year-end
            2025-W40.md
    01_Ideas/  02_Backlog/  03_Active/  04_Archived/
```

If `00_Weekly_Logs/` doesn't exist yet, create it (and `capture.md`, empty)
before writing the first week file.

---

## File Naming — ISO Week

Week files are named `<ISO-year>-W<ISO-week>.md`, e.g. `2026-W28.md`. This
format sorts lexicographically in the same order as chronologically, so a
plain directory listing of `00_Weekly_Logs/` already reads oldest-to-newest
with no extra logic needed.

Compute the current ISO week with Python rather than `date +%G-W%V` — BSD
`date` on macOS (a read-only pull target for this repo) doesn't reliably
support `%V`/`%G`, and this repo avoids GNU-only flags:

```bash
python3 -c "import datetime as d; y,w,_=d.date.today().isocalendar(); print(f'{y}-W{w:02d}')"
```

Use this same command to resolve "this week", "last week" (subtract 7 days
first), or any relative week reference before touching a file — don't guess
the week number by hand.

---

## Week File Structure

```markdown
# 2026-W28 (Jul 6 – Jul 12)

# Outline

- [ ] [Project Foo](../03_Active/Project_Foo/outline.md)
    - [ ] Ship the v2 API migration
    - [ ] Write tests for the new endpoint
- [ ] Renew car registration
- [x] Book dentist appointment
- [ ] ~Investigate flaky CI~

# Progress

Free-form notes on how the week is actually going.
```

**`# Outline`** — top-level checkboxes are one of two kinds:

1. **Task-linked** — `[Task Name](relative/path/to/outline.md)`, using the
   `[]()` markdown link form specifically so `gf`/`gx` in nvim can jump
   straight to the task's `outline.md`. The path is relative to the week
   file's location (e.g. from `00_Weekly_Logs/2026-W28.md` to a task in
   `03_Active/`, that's `../03_Active/Project_Foo/outline.md`).
2. **General item** — plain text, no link, for something that matters this
   week but doesn't warrant its own task directory (e.g. "Renew car
   registration"). If it grows in scope, promote it to a real task directory
   via the `task-management` skill and turn the log entry into a link.

Sub-items under a task-linked item are **the near-term subset** of that
task's own outline the week is targeting — not a duplicate of the whole
thing. Nest sub-items as deep as actually useful; there's no fixed depth
requirement. Ordering follows the same convention as `task-management`:
completed items at top, active items in the middle, cancelled (`~struck~`)
at the bottom, applied at every nesting level.

**`# Progress`** — free prose, no required structure. This is scratch space
for how the week is actually unfolding; don't impose the Outline's checkbox
format on it.

---

## capture.md — The Un-triaged Inbox

`00_Weekly_Logs/capture.md` is a single persistent file (not per-week) for
items the user raises that aren't dedicated tasks yet and haven't been
decided as this-week priorities either. Append freely, one item per line, no
required format — it's a scratchpad, not a tracked outline.

Don't triage it opportunistically on every mention — the audit pass happens
specifically at weekly rollover (see below), so items get a deliberate,
batched review rather than being silently promoted or dropped mid-conversation.

---

## Weekly Rollover

When asked to check on / create / roll over the week's log, or before adding
new Outline items, first check whether the latest file in `00_Weekly_Logs/`
matches the current ISO week. If it's behind, the old week has "expired" and
needs closing out before a new file is created.

Load `references/weekly-rollover.md` for the full procedure — it covers the
year-archival step, the per-item migration prompt (never silently carry
forward or drop an incomplete item without asking), and the capture.md
promotion audit that runs as part of creating the new file.

---

## Outline Sync Check

Because the log's sub-items are a deliberately partial view of a task's full
outline, they drift: a task's outline moves on, gets items completed or
reworded, and the log's stale copy doesn't know. Load
`references/outline-sync.md` when auditing a week file, reviewing task-linked
items before rollover, or when the user asks whether the logs and tasks agree.

---

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`).
Do not guess their contents — read them.

- **references/weekly-rollover.md** — load when: checking if the current
  week's log exists, creating a new week file, migrating incomplete items
  from an expired week, or triaging `capture.md`.
- **references/outline-sync.md** — load when: auditing a week file's
  task-linked items against their actual task outlines, or before migrating
  items during rollover (so migration reflects current reality).
