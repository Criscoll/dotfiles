# Weekly Rollover

Full procedure for detecting an expired week, archiving old years, migrating
incomplete items, and triaging `capture.md`. Runs whenever the current
week's log doesn't exist yet.

## 1. Detect expiry

Compute the current ISO week:

```bash
python3 -c "import datetime as d; y,w,_=d.date.today().isocalendar(); print(f'{y}-W{w:02d}')"
```

List `00_Weekly_Logs/*.md` (excluding `capture.md`). Since filenames sort
lexicographically in chronological order, the last one alphabetically is the
latest existing week. If it equals the current ISO week, nothing to do. If
it's behind, that file is the "expiring" week and rollover proceeds.

## 2. Year archival (only when the year changes)

If the current ISO week's year differs from the year of the flat files
sitting in `00_Weekly_Logs/`, move all existing flat `*.md` week files
(never `capture.md`) into a subfolder named after their year, e.g.:

```bash
mkdir -p 00_Weekly_Logs/2025
mv 00_Weekly_Logs/2025-W*.md 00_Weekly_Logs/2025/
```

Do this once, before creating the new week's file. Task-links inside
already-archived files are **not** rewritten — they become a historical
snapshot. If a link later 404s because the linked task moved to
`04_Archived/`, that's expected; resolve by searching for the task name
rather than assuming the relative path still holds.

## 3. Migrate incomplete items from the expiring week

Read the expiring week's `# Outline`. For every top-level item that is
**not** already `[x]` complete and **not** `~cancelled~`, it needs a
decision. Never carry forward, mark done, or drop an item silently — the
whole point of this step is user judgment about what actually happened,
which isn't recoverable from the file alone.

Batch every open item into a single question (or one `AskUserQuestion` call
with multiple questions) rather than asking one at a time — per this
project's global convention on batching decisions. For re-deriving a
task-linked item's sub-items from the task's current outline, use the same
round-based `AskUserQuestion` pattern as first-ever population — see
`askuserquestion-population.md`.

For each open item, the possible outcomes are:

- **Done, untracked** — the work happened but the checkbox was never ticked.
  Mark `[x]` in the *old* file; do not carry forward.
- **Still relevant** — carry forward into the new week's Outline. For a
  task-linked item, don't just copy the old sub-items verbatim — re-derive
  them from the task's *current* outline (see `outline-sync.md`) so the new
  week starts from what's actually next, not a stale snapshot.
- **No longer a priority** — leave it in the old file, optionally
  `~struck through~`; do not carry forward. This is different from "done" —
  it's an explicit deprioritization, not completion.
- **Outgrew the log entry** — a general (non-task) item that turned out to
  need its own task directory. Hand off to the `task-management` skill to
  create it, then carry forward as a task-linked item pointing at the new
  `outline.md`.

## 4. Create the new week file

```markdown
# <ISO-year>-W<ISO-week> (<Mon date> – <Sun date>)

# Outline

<carried-forward items, freshly derived>

# Progress

```

Leave `# Progress` empty — it's the coming week's scratch space, not a
place to summarize the closed week.

## 5. Triage capture.md

This runs as part of creating the new week file — not on a separate
schedule — so unresolved capture items get a deliberate checkpoint exactly
when the week's priorities are being reset anyway.

For each entry in `capture.md`, judge (asking the user when it's not
obvious) which of these applies:

- **Promote to this week's Outline** — as a general item, or as a
  task-linked item if a task directory already covers it.
- **Promote to a new task directory** — the item has grown into something
  that needs its own `outline.md`, brief, and lifecycle stage. Hand off to
  the `task-management` skill's creation flow, then link it from the new
  week's Outline.
- **Leave in capture.md** — still real but not ready to act on; keep it for
  next rollover rather than forcing a decision prematurely.
- **Discard** — no longer relevant.

Remove promoted or discarded entries from `capture.md` so the file only ever
holds genuinely pending items — it should shrink as things move out, not
grow unbounded.
