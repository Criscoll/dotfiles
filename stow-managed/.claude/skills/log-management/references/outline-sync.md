# Outline Sync Check

A week's log intentionally shows only a curated subset of a task's full
outline — so it drifts by design. This check isn't about making the two
identical; it's about catching the cases where the log is now **wrong**
rather than just partial.

## Procedure

For each task-linked top-level item in the week's `# Outline`:

1. Resolve the link target (the `(relative/path/to/outline.md)` part) and
   read that task's actual `# Outline` section.
2. For each of the log's sub-items under that link, check whether the same
   item (by meaning, not necessarily exact text) still appears in the task
   outline as an incomplete leaf.

## What counts as a mismatch

- **Log sub-item has no match in the task outline** — either it was
  completed and removed, reworded, or dropped in the task's own outline
  without the log being told. Flag it; don't guess which — ask, or infer
  from context if the task outline shows an obviously equivalent completed
  item nearby.
- **Task outline shows the matching item as complete, but the log still
  shows it unchecked** — the log is stale. Safe to tick off in the log
  directly; this direction doesn't touch the task outline at all.
- **Task outline has significant new incomplete items that aren't reflected
  anywhere in the log** — not automatically a problem (the log is allowed to
  be a subset), but worth surfacing if the week is about to roll over, since
  the migration step in `weekly-rollover.md` should pull from current
  reality, not the log's existing (possibly outdated) subset.

## Direction of trust

The task's own `outline.md` is always the more granular and reliable
per-task tracker — never edit it to match the log. Reconciliation only ever
flows log ← task, never the reverse. If a discrepancy suggests the *task*
outline itself is wrong (e.g., it's missing something the user clearly did),
that's a `task-management` concern to fix on the task side directly, not
something this check resolves by writing to the log.

## When to run this

- On demand, when the user asks whether logs and tasks agree.
- Before migrating items during weekly rollover (see `weekly-rollover.md`
  step 3), so carried-forward sub-items reflect the task's current state
  rather than a stale copy.
