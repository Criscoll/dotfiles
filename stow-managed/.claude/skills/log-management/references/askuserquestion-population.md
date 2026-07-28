# Populating the Outline via AskUserQuestion

When creating a new week's log — first-ever population, weekly rollover
migration, or a mid-week update with more than one plausible candidate —
default to driving it with `AskUserQuestion` rather than asking the user to
freehand list everything. Round after round of small multi-select choices
beats one big open-ended prompt: recognizing and picking from candidates is
much faster to answer than recalling and typing from scratch. This was
validated in practice as fast and low-effort for the user.

## Procedure

### 1. Discover candidates

```bash
fd "outline.md" <repo>/02_Workbench/03_Active/
```

Exclude anything under a `02_Archived/` (or similarly named archived)
subfolder inside an active task — those aren't candidates for this week.

### 2. Round 1 — which tasks are active this week

Group the discovered tasks by their naming-convention category prefix
(`Goal_`, `Health_`, `Project_`, `Shopping_`/`Tooling_`/`Travel_`/etc. — see
the `task-management` skill's naming convention). Batch into
`AskUserQuestion` calls of up to 4 questions, each `multiSelect: true`, up
to 4 options per question (the tool's hard limits). One question per
category cluster works well:

- header: short category name (e.g. "Goals", "Health", "Projects")
- question: "Which `<category>` threads are active this week?"
- options: one per task — label = readable task name, description = the
  raw directory name (so it's traceable back to the filesystem)

If a category has more than 4 tasks, split it across two
questions/calls rather than dropping items silently — every discovered
task should get a chance to be selected across however many rounds it
takes.

### 3. Round 2+ — near-term slice per selected task

For every task the user selected in round 1, read that task's own
`outline.md` and extract open (`- [ ]`, not `~cancelled~`) items:

```bash
grep -n "^- \[ \]\|^    - \[ \]\|^        - \[ \]" <task>/outline.md
```

Batch these into further `AskUserQuestion` calls (again up to 4
questions/call, up to 4 options/question, `multiSelect: true`), one
question per task, options = candidate open items trimmed to a short
label (full context in the option's `description`). This lets the user
pick which slice of the task's outline this week is actually targeting,
instead of free-typing it.

### 4. Handle custom / "Other" answers carefully

The tool always offers a free-text "Other" alongside whatever's listed —
don't spend one of the 4 option slots on a "skip"/"none" option; the user
can decline by not selecting anything relevant or by using Other.

Read custom/Other text literally and follow it:

- **Already done** — if the user reports something as already complete
  (e.g. "I already replied to X"), record it as `[x]` in the new week's
  Outline, not as a pending item.
- **Belongs to a different task** — if the free text actually describes
  work that fits a *different* task than the one being asked about (e.g.
  answering a "Moving Overseas" question with a financial-modeling detail
  that's really `Project_Financial_Spreadsheets`' concern), don't force it
  under the asked task. Flag the better-fitting task-link to the user and
  let them confirm or redirect before writing it.
- **No matching task** — custom text that doesn't fit any existing task
  becomes either a new sub-item under whichever task-link it was answered
  against, or a general (non-linked) Outline item if it doesn't belong to
  any task at all.

### 5. capture.md doesn't fit this pattern

`capture.md` entries are inherently open-ended and unbounded — don't force
a "dump your un-triaged items" prompt into `AskUserQuestion`'s fixed-option
format. Ask for it as a plain conversational question instead ("anything
else on your mind that isn't a priority yet?"), after the structured
rounds are done.

### 6. Write the file

Assemble the selected task-links and their chosen sub-items into the
`# Outline` section per the structure in `SKILL.md`, applying the usual
ordering (completed → active → cancelled) and using the correct relative
path from the week file to each task's `outline.md`.

## When this applies

- **First-ever population** of a new/empty week file (no prior week to
  migrate from).
- **Weekly rollover migration** (`weekly-rollover.md` step 3) — instead of
  one big freeform "what's still relevant" question, use this same
  round-based pattern: discover candidates from the previous week's
  still-open items plus any newly-relevant active tasks, then ask
  category-batched multi-select questions to decide what carries forward
  and what its refreshed near-term slice looks like.
- **Mid-week updates** — when the user asks to add something to the
  current week's Outline and there's more than one plausible task/item it
  could map to, prefer a quick `AskUserQuestion` round over guessing.
