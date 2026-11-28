# Populating Goals and Today via AskUserQuestion

When choosing a week's goals, rolling over, populating Today, or making a
mid-week addition with more than one plausible candidate, drive it with
`AskUserQuestion` rather than asking the user to freehand list everything. Round
after round of small choices beats one big open-ended prompt: recognising and
picking from candidates is much faster than recalling and typing from scratch.
This was validated in practice as fast and low-effort for the user.

The log is independent of the 02_Goals calendar. Don't read it for candidates
unless the user asks (e.g. "use my recent needles as a reference"); then treat
its entries as candidate wording and still run them through the steps below.

## Part A — Weekly Goals

### 1. Discover candidates

```bash
fd "outline.md" <repo>/02_Workbench/03_Active/
```

Exclude anything under a `02_Archived/` (or similarly named archived)
subfolder inside an active task. When rolling over, add the carried goals from
`weekly-rollover.md` step 3 so they aren't asked about twice.

### 2. Round 1 — which tasks are goals this week

Group the discovered tasks by naming-convention category prefix (`Goal_`,
`Health_`, `Project_`, `Shopping_`/`Tooling_`/`Travel_`/etc. — see the
`task-management` skill). Batch into `AskUserQuestion` calls of up to 4
questions, each `multiSelect: true`, up to 4 options per question (the tool's
hard limits). One question per category cluster works well:

- header: short category name (e.g. "Goals", "Health", "Projects")
- question: "Which `<category>` threads are goals this week?"
- options: one per task — label = readable task name, description = the raw
  directory name (so it's traceable back to the filesystem)

If a category has more than 4 tasks, split it across questions/calls rather than
dropping items silently — every discovered task gets a chance to be selected.

### 3. Round 2 — fix the success lines for each selected task

For every task selected in round 1, read its `outline.md` and extract the open
items:

```bash
rg -n '^\s*- \[ \]' <task>/outline.md | rg -v '~'
```

Turn the most plausible next outcomes into candidate success lines. Each
must pass the outcome test in `SKILL.md`: reword vague items ("Research
flights") into the concrete result ("Flight options sent to Sam with a pick
requested by Sunday") before offering them. One question per task, up to 4 per
call, **multi-select** — a goal can carry several success lines, and the user
picks the outcomes this week must deliver. Option label = a short form of the
outcome; description = the full success-line sentence that will be written into
the file. For a task carried over from last week, include its unticked success
lines among the options, marked as carried.

One pick becomes a plain bullet under the goal; two or more become
sub-checkboxes (see `SKILL.md`). If an Other answer combines outcomes in one
sentence, split them into separate success lines so each can be checked on its
own.

### 4. Handle custom / "Other" answers carefully

The tool always offers a free-text "Other" — don't spend an option slot on
"skip"/"none"; the user can decline by not selecting anything relevant or using
Other. Read custom text literally and follow it:

- **Already done** — if the user reports something as already complete (e.g. "I
  already replied to X"), record it as `[x]`, not as a pending goal.
- **Belongs to a different task** — if the text describes work that fits a
  *different* task than the one being asked about (e.g. a financial-modelling
  detail given against "Moving Overseas" that's really
  `Project_Financial_Spreadsheets`' concern), don't force it under the asked
  task. Flag the better-fitting link and let the user confirm or redirect
  before writing it.
- **No matching task** — text that fits no existing task becomes a general
  (non-linked) goal, worded as an outcome.
- **Vague text** — if a freehand answer fails the outcome test, propose the
  concrete rewording and confirm it; don't write the vague version.

### 5. capture.md doesn't fit this pattern

`capture.md` entries are open-ended and unbounded — don't force a "dump your
un-triaged items" prompt into `AskUserQuestion`'s fixed-option format. Ask
conversationally instead ("anything else on your mind that isn't a priority
yet?"), after the structured rounds are done.

## Part B — Today

Candidates come from the goals, not from the task outlines: for each open goal,
propose the next concrete step toward one of its open success lines today (and
any carried entries from `today-rollover.md` step 3 are already in). One
`multiSelect: true` question per cluster of goals, options = step phrased as a
specific action ("Email Bank A to cancel the settlement"), description = the
goal it serves. Each step must pass the outcome test — specific enough to start
without thinking. If there are more goals than fit in one call, ask about the
ones nearest to being met first. Custom/Other text follows the same rules as
step 4 above; a freehand entry that serves no goal is kept if the user wants it,
with a one-line note that it's off-goal.

## Writing the file

Assemble the choices into `# Weekly Goals` and `# Today` per the structure in
`SKILL.md`: completed → active → cancelled ordering (at every level), each task
once with its success lines beneath it (a plain bullet if one, sub-checkboxes if
several), flat Today entries, and the correct relative path from the week file to
each task's `outline.md`.

## When this applies

- **First-ever population** of a new/empty week file (Parts A and B).
- **Weekly rollover** (`weekly-rollover.md` steps 3 and 5) — Part A for new goals
  and refreshed success lines, Part B for the new week's first Today.
- **New day** (`today-rollover.md` step 4) — Part B only.
- **Mid-week additions** — when the user asks to add something and there's more
  than one plausible task/goal it could map to, prefer a quick `AskUserQuestion`
  round over guessing.
