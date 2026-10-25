# Weekly Rollover

Full procedure for detecting an expired week, archiving old years, closing out
the old week's goals, and creating the new week's file. Runs whenever the
current week's log doesn't exist yet.

## 1. Detect expiry

Resolve the current ISO week with the Melbourne-time command in `SKILL.md`
(never `date.today()` — on a UTC box it picks the wrong week on Monday morning).

List `00_Weekly_Logs/*.md` (excluding `capture.md`). Filenames sort
lexicographically in chronological order, so the last one is the latest existing
week. If it equals the current ISO week, nothing to do. If it's behind, that
file is the "expiring" week and rollover proceeds.

## 2. Year archival (only when the year changes)

If the current ISO week's year differs from the year of the flat files sitting
in `00_Weekly_Logs/`, move all existing flat `*.md` week files (never
`capture.md`) into a subfolder named after their year, once, before creating the
new week's file:

```bash
mkdir -p 00_Weekly_Logs/2025
mv 00_Weekly_Logs/2025-W*.md 00_Weekly_Logs/2025/
```

Task-links inside already-archived files are **not** rewritten — they become a
historical snapshot. If a link later 404s because the linked task moved to
`04_Archived/`, that's expected; search by task name rather than assuming the
relative path still holds.

## 3. Close out the expiring week

First, resolve the expiring file's stale `# Today` section: run the steps in
`today-rollover.md` against that file, so the final day is folded into *that
week's* `# Progress`. Unticked Today entries still need a carry/drop decision —
the carried ones land in the new week's Today (step 6).

Then read the expiring file's `# Weekly Goals`. Files written before the
Today/Weekly Goals structure have `# Outline` instead: treat its **top-level
items** as the goals and ignore the nested checkboxes — those were a partial
copy of the task's outline, not goals, so use them only as raw material for
proposing new success lines.

For every goal that is **not** already `[x]` and **not** `~cancelled~`, a
decision is needed. Success lines already ticked are done and stay behind in the
old file; the decision covers the goal's unticked lines (or the goal itself, for
a single-line or general goal). Never carry forward, tick, or drop one silently
— the point of this step is the user's judgement about what actually happened,
which can't be recovered from the file. Batch every open goal into one
`AskUserQuestion` call (up to 4 questions, one per goal or per cluster; options
below).

- **Done, untracked** — the work happened but the box was never ticked. Tick the
  line (and the goal, if that was its last open line) in the *old* file; do not
  carry it forward.
- **Still relevant** — carry into the new week. The task's focus may have
  changed, and repeating a line that didn't happen hides the drift, so ask which
  unticked lines still stand and what else this week's success lines should be.
  Offer the standing lines as options (carried as-is) alongside candidate new
  ones, multi-select (see `askuserquestion-population.md`). A general goal keeps
  its text unless the user rewrites it.
- **No longer a priority** — leave the goal or line in the old file, optionally
  `~struck through~`; do not carry it forward. This is explicit deprioritisation,
  not completion.
- **Outgrew the log entry** — a general goal that now needs its own task
  directory. Hand off to the `task-management` skill, then carry forward as a
  task-linked goal pointing at the new `outline.md`.

### Reflect on the carried goals

The weekly log is the only record of the week's goals, so this is where drift gets exposed.
Each goal decided **Still relevant** also gets one reflection line, written into the
*expiring* file's `# Progress`:

```markdown
Reflection — <Task Name> (carried Nx): <sentence>
```

- **The sentence answers "what tangible thing exists now that didn't a week ago?"** — a
  message sent, a booking made, a decision written into the outline. "Spent time on it" and
  "looked into options" are not reflections; they are the fake-productivity pattern. If
  nothing tangible exists, write `Nothing tangible.` That is an honest answer, and the count
  beside it is what makes a stall visible.
- **Draw the sentence from** the ticked success lines, the Progress lines and what changed
  in the outline. Propose all of them in one batch for the user to confirm or correct, rather
  than asking each cold.
- **N is derived, not maintained**: the number of consecutive weekly logs, ending with the
  expiring one, whose `# Weekly Goals` link this task. Use the link path after `03_Active/`:

  ```bash
  rg -l -F '<Task_Dir>/outline.md' ~/Repos/scribbles/02_Workbench/00_Weekly_Logs \
    --glob '*-W*.md' | sed 's|.*/||' | sort -r
  ```

  Count the unbroken run of ISO weeks from the expiring week backwards; a gap ends it. Year
  folders such as `2025/` are searched too. Quote N when you ask the Still relevant
  question, so a long carry is visible while the user decides.
- **Logs only reach back so far**, so a goal that predates them is undercounted. If the user
  says the real figure is higher, use theirs.
- Goals decided Done untracked, No longer a priority or Outgrew the log entry get no
  reflection: nothing is carried, so there is no drift to expose.

## 4. Check task links

For each task-linked goal being carried, resolve the link target:

- **Link 404s** — the task probably moved lifecycle stage. Search
  `03_Active/`, `02_Backlog/` and `04_Archived/` by task name. If it's now in
  `04_Archived/`, the goal is probably done or dead — ask before carrying it. If
  it moved to another active stage, carry it with the corrected relative path.
- **Linked outline has no open `- [ ]` items left** — the task looks finished;
  flag it and ask whether the goal should close instead of carry.

The old week's file is never edited to fix links (historical snapshot).

## 5. Pick the new week's goals

Run the round-based `AskUserQuestion` pattern in
`askuserquestion-population.md` for any new goals beyond what's carried: discover
active tasks, ask which are goals this week, then fix each one's success lines.
Check every success line and general-goal text against the outcome test in
`SKILL.md` before writing it.

## 6. Create the new week file

```markdown
# <ISO-year>-W<ISO-week> (<Mon date> – <Sun date>)

# Today (<Day Mon DD>)

<carried Today entries, fresh and unticked; plus any the user adds>

# Weekly Goals

<carried and new goals, each with its success lines per SKILL.md>

# Progress

```

Use the command in `SKILL.md` for the headings. Offer to populate Today using
the Today pattern in `askuserquestion-population.md`; an empty Today under a
correct heading is fine if the user wants to fill it later. Leave `# Progress`
empty — it is the new week's scratch space, not a summary of the closed week.

## 7. Triage capture.md

This runs as part of creating the new week file, so unresolved capture items get
a deliberate checkpoint exactly when priorities are being reset anyway. For each
entry, judge (asking the user when it's not obvious):

- **Promote to this week's Weekly Goals** — as a general goal, or a task-linked
  goal if a task directory already covers it (with a success line).
- **Promote to a new task directory** — it has grown into something that needs
  its own `outline.md`, brief, and lifecycle stage. Hand off to the
  `task-management` skill's creation flow, then link it from Weekly Goals.
- **Leave in capture.md** — still real but not ready to act on; keep for next
  rollover rather than forcing a decision.
- **Discard** — no longer relevant.

If the user defers the triage, leave `capture.md` untouched and say so. Remove
promoted or discarded entries so the file only ever holds genuinely pending
items — it should shrink as things move out, not grow unbounded.
