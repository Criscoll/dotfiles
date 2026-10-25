# Cross-task — implications and overlap

Tasks depend on each other in ways no single outline records. When one task changes, text in
another can become false. When two tasks grow toward each other, the same deliverable ends up
owned twice. This file finds both. Every fix is a question, as with every other write.

**Inputs:**
- Every active outline, already read in run step 3.
- The `TASKS: backlog entries` names from the snapshot. Read a backlog outline only when its
  name suggests an overlap.

## Implication sweep (every run)

1. **Seed set.** Start with:
   - tasks changed this run, or about to change from confirmed fixes;
   - linked tasks whose outline shows a status change this week: a Brief `Status (<date>)`
     line, or newly ticked or struck items.
2. **Find dependents.** For each seed, search the other active outlines:
   - relative links to the seed's `outline.md`;
   - the seed's task name or its key terms;
   - shared entities: people, institutions, bookings, dates, documents, deadlines.

   `rg` across `02_Workbench/03_Active/` is the quick way.
3. **Test each dependent line.** Does the seed's change make this line false, moot,
   unblocked or newly urgent? If not, move on.

Worked examples:
- **Refinance off.** `Home_Refinance_Mortgage_NAB_to_Up` now reads "Status (2026-10-23): Up
  declined; the refinance is off". In `Goal_Legally_Change_my_Last_Name/outline.md`, two
  lines change:
  - "Mortgage / refinance — bundling opportunity" is now moot.
  - "Land title… bundle with the Up refinance if it proceeds; standalone… if refinance falls
    through" now resolves to its standalone branch.
- **Shared Alishan plan.** `Goal_Propose_to_Mimi` depends on the Alishan skeleton in
  `Travel_Hong_Kong_Taiwan_2026_2027`. When that skeleton changes, check the proposal's
  primary window.

Fixes to propose (each confirmed):
- Strike a moot line, adding `— <reason>`.
- Keep the branch that now applies and strike the other.
- Tick a line that is now satisfied.
- Update a Brief status line that is now false.
- Add a `see [Task](../Task/outline.md)` cross-link where the dependency was implicit.

## Overlap audit (weekly rollover, or `overlap`)

Look for three patterns:
- **(a)** one deliverable owned by two tasks;
- **(b)** a task that is mostly a sub-part of another;
- **(c)** a backlog entry that duplicates an active task.

Offer these options for each finding:

- **Narrow scope.** Edit both briefs to state the split, and strike the duplicate item in the
  non-owner with `— see [Y](…)`.
- **Fold as a sub-task.** Move the task into the larger task's `01_Tasks/<Category_Name>/`,
  following task-management's sub-task rules. The parent then references the sub-task path
  instead of restating it.
- **Merge and archive.** Fold the content into the surviving task. Then move the absorbed
  directory to `04_Archived/<YYYY_H1|H2>/`, using the current half-year from the Melbourne
  date.
- **Leave.** Optionally add cross-links.

Name full repo-relative paths in every question. That satisfies task-management's rule to
confirm the target task before editing.

After any move or merge, `rg` for the old directory name. Fix the links you find in the
current week's log and in other outlines. Leave past logs alone: they are historical
snapshots.

## Don't over-flag

Tasks referencing each other is normal and healthy. Flag only two things: double ownership
of a deliverable, or a change that makes existing text wrong. A sweep that reports every
shared word buries the one implication that matters.
