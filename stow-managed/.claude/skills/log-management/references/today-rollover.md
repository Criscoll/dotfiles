# Today Rollover

Closes out a finished day's `# Today` section and sets up the next one. Runs
when the heading's date differs from today's date (Melbourne time, from the
command in `SKILL.md`), when a new week file is being created, or when the user
asks to start the day. A stale Today is the only way old entries get lost or
silently carried, so this is the checkpoint.

## 1. Detect staleness

Read the `# Today (<Day Mon DD>)` heading in the current week's file (or in the
expiring file, when called from `weekly-rollover.md`).

- Date equals today → nothing to roll; add entries normally.
- Heading missing (new file) → skip to step 4.
- Date earlier than today → stale; continue. If it is several days stale, the
  entries belong to the heading's date, not to the days in between. Fold them
  under that date and don't invent entries for the skipped days.

## 2. Fold the finished day into Progress

Add one line to the end of `# Progress` in the file that holds the stale Today,
starting with the **heading's date** (not today's):

```markdown
Mon Oct 26 — Emailed NAB, MSA and Up to call off the settlement; Alishan hotel not booked.
```

Summarise the ticked entries as short phrases and mention untouched or dropped
ones only when notable. Don't paste checkboxes — Progress is prose, and a
checkbox there would look like a live task. Skip the line entirely if nothing
was ticked and nothing is worth noting; an empty day needs no record.

## 3. Decide the unticked entries

For each unticked, un-struck entry, never carry or drop silently — whether it
still matters can't be recovered from the file. Batch them into one
`AskUserQuestion` call (up to 4 questions of up to 4 options; split across
calls if there are more):

- **Done, untracked** — happened but never ticked. Count it in the Progress line
  from step 2.
- **Carry to today** — copy it fresh and unticked into the new Today (step 4).
- **Drop** — no longer needed. Mention it in the Progress line only if the
  reason is worth remembering.

If the user ticked an entry that satisfies a success line, point it out and tick
the line in `# Weekly Goals` (and the goal, if that was its last open line) if
they agree.

## 4. Write the fresh Today

Replace the whole `# Today` section in the current week's file: new heading with
today's date, carried entries first (unticked), then any new ones. Populate new
entries with the Today pattern in `askuserquestion-population.md`, and check each
against the outcome test in `SKILL.md` — specific enough to start, loosely tied
to a weekly goal. An empty Today under a correct heading is acceptable if the
user would rather fill it in themselves.

The fold in step 2 is the record, so within a week the old entries do not stay
in the file.

When this runs from `weekly-rollover.md`, steps 1–3 act on the *expiring* file
and this step writes into the *new* week's file. Leave the expiring file's last
Today section as it is — that file is a closed historical snapshot and its
Progress already holds the fold.
