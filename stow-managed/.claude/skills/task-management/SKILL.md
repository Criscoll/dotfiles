---
name: task-management
description: >-
  Apply the task management conventions for the scribbles workbench — task
  lifecycle, naming, outline.md structure, todo list format, and sub-task rules.
  Auto-invoke BEFORE creating a new task, editing any outline.md, moving a task
  between stages, or reviewing workbench structure. Trigger phrases: "create a
  task", "new task", "outline.md", "workbench", "02_Workbench", "move to active",
  "move to backlog", "move to archived", "task outline", "add to backlog",
  "outline structure", "closing criteria", "success criteria", "brief".
disable-model-invocation: false
---

# Workbench Task Conventions

The workbench root is at `~/Repos/scribbles/02_Workbench/`.

Apply these rules whenever you create, edit, or move tasks inside `02_Workbench/`.

---

## Identifying the Target Task

Before editing, moving, or reviewing an **existing** task, resolve exactly which
task directory is meant:

1. **Direct path given** — the request includes a full path to a task directory
   or `outline.md` (e.g. `02_Workbench/03_Active/Project_Foo/outline.md`). Use
   it as given; no confirmation needed.
2. **Rough description given** — the request names a task by description only
   (e.g. "the foo project task", "the thing we're doing with X"). Search
   `02_Workbench/` for matching task directories, then **state the full
   resolved path and ask the user to confirm it before making any edits.**
   If multiple candidates match, list them and ask which one. Do not guess and
   proceed silently — a wrong match edits the wrong task.

This confirmation step applies to edits, moves, and reviews of existing tasks.
It does not apply to creating a brand-new task (see "Creating a New Task"
below), where the directory doesn't exist yet.

---

## Task Lifecycle

Tasks move through stages in this order:

```
01_Ideas/ → 02_Backlog/ → 03_Active/ → 04_Archived/
```

`04_Archived/` is grouped by half-year subdirectory (e.g. `2025_H1/`, `2026_H1/`).

`02_Backlog/` uses an Eisenhower-style priority structure — pick the right bucket
rather than dumping everything into one:

```
00_Up_Next/
01_Important_and_Urgent/
02_Important_Not_Urgent/
03_Unimportant_and_Urgent/
04_Unimportant_Not_Urgent/
```

---

## Task Naming

Directory names follow a `Category_Name` pattern. Use underscores, never spaces.
Valid category prefixes:

```
Project_  Goal_  Travel_  Tooling_  Shopping_  Health_
Renovation_  Relationship_  Chore_  Investing_  Home_
```

---

## outline.md — The Required Landing Page

Every task directory must have an `outline.md`. It is the single source of truth.
Structure follows this order (only `# Brief` and `# Outline` are required):

1. **`# Brief`** — the *why*: motivation, constraints, guiding principles. Plain prose.
2. **`# Success Criteria`** or **`# Closing Criteria`** (optional) — what "done" looks like.
3. **`# Outline`** — the recursive todo list (see format below).
4. **`# Notes`** (optional) — a markdown table indexing files in `01_Notes/`:
   ```markdown
   # Notes

   | File | Summary |
   |------|---------|
   | [research.md](01_Notes/research.md) | One-line description |
   ```
5. **`# Details`** (optional) — structured reference data: dates, IDs, contacts.

Use `# Outline` (not `# Recursive Outline`) going forward.

For tasks with distinct workstreams, split the outline into `## Deep Work` and
`## Shallow Work`. For long-horizon goals, use `## Phase 1`, `## Phase 2`, etc.

---

## Todo List Format

```markdown
- [x] Completed task
- [ ] Incomplete task
    - [ ] Subtask
        - [ ] Atomic, actionable leaf step
- [ ] ~Cancelled or deprecated task~
- [ ] Task that is **blocked**
```

**Ordering within any list (apply at every nesting level):**

```
1. [x] Completed items   ← top (history)
2. [ ] Active items      ← middle (in progress / todo)
3. [ ] ~Cancelled items~ ← bottom (abandoned)
```

This makes the list read chronologically — done, then doing, then abandoned.
Apply the same ordering to subsections: a subsection where all items are complete
appears before one where nothing is complete.

Key rules:
- A parent checkbox is only complete when **all** its children are complete.
- Break top-level items (milestones) down until every leaf is a single, concrete action.
- Inline context may be added as indented plain lines (no bullet) beneath a task.

---

## Sub-Tasks

When a task spawns sub-tasks, use this structure:

```
Task_Name/
    outline.md
    00_Aliases/       — quick-reference snippets (if needed)
    01_Tasks/         — sub-task directories, each with their own outline.md
        Goal_SubTask/
            outline.md
    02_Archived/      — completed or abandoned sub-tasks
```

- A directory inside `01_Tasks/` **with** an `outline.md` is a sub-task.
- A directory inside `01_Tasks/` **without** an `outline.md` is supporting material.
- Sub-task outlines must not duplicate content from the parent outline. The parent
  references the sub-task path instead:
  ```
  - [ ] Task name — see 01_Tasks/SubTask_Name/outline.md
  ```

When reviewing or editing a parent outline, always check whether a `01_Tasks/`
directory exists. If it does, read each sub-task outline and verify:
1. No content in the sub-task duplicates content in the parent.
2. The parent references the sub-task path rather than restating its detail.
3. The sub-task outline is clean (not a junk file with stray links or unrelated content).

---

## Creating a New Task

**Before writing anything**, check whether you can confidently answer all three:
1. What is the motivation? (why this task, why now)
2. What does done look like? (scope, success signal)
3. Which category and stage does it belong in?

If any answer is unclear, **ask first** rather than guessing. Present all unknowns in a single structured question — don't drip them one at a time.

If the user wants to proceed despite ambiguity, start the `# Outline` with `[ ] Decide: ...` items that resolve the open questions before any action tasks appear:

```markdown
# Outline

- [ ] Decide: which approach to take (option A vs option B)
- [ ] Decide: whether to include X in scope
- [ ] Task that depends on the above decisions
```

Once you have enough to proceed:

1. Create a directory using the `Category_Name` convention in the appropriate stage.
2. Create `outline.md` with at minimum a `# Brief` and `# Outline` section.
3. Write the brief first — capture the motivation, constraints, and any decisions still open.
4. Add `# Success Criteria` if there's a clear definition of done.
5. Break the outline down until every leaf task is atomic and actionable.
