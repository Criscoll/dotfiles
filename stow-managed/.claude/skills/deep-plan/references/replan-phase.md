## Re-plan phase (failure recovery)

Triggered explicitly — never automatically. When the orchestrator (see
`plan-phase.md`'s EXECUTE.md template) hits a failure, it documents and halts;
it never re-plans itself. Getting the roadmap moving again is a deliberate,
user-initiated step: they read the item's `FAILURE.md`, decide it's worth
pursuing, and explicitly ask to re-plan that item. This phase is what runs
when `$ARGUMENTS` names that — e.g. "replan item 3", "re-plan item 3: the
retry logic assumed the API was idempotent and it isn't".

1. **Identify item N** from `$ARGUMENTS`. Read `items/NN-<slug>/FAILURE.md` —
   it exists precisely because a prior Execute run halted here. If it's
   missing, the user is asking to re-plan an item that never failed (maybe
   they just changed their mind, not recovering from a failure); confirm
   that's really what they want before proceeding — this phase's steps still
   apply, just without a failure report to start from.

2. **Re-read the whole roadmap**, not just item N: `ROADMAP.md`,
   `CONTRACTS.md`, and every `items/*/PLAN.md` and `items/*/REQUIREMENTS.md`.
   A wrong assumption in item N's plan may also implicate items after it, and
   any contract item N produces may need to change shape — you can't judge
   either from item N's files alone.

3. **Treat FAILURE.md's Root-cause theory as a hypothesis, not a settled
   fact.** Validate it against the codebase and current state — run
   `git status`/`git diff` and reconcile the actual working tree against what
   FAILURE.md's Working-tree state section described (the failed attempt may
   have left partial changes, or the user may have already touched things
   manually). Don't plan on top of an assumption you haven't checked.

4. **Re-run Refine for item N alone**, using `refine-phase.md`'s mechanics
   (restate, validate against the codebase as it exists *now* — including
   whatever the failed attempt partially applied — ask if unclear, rewrite
   `REQUIREMENTS.md`). Then **re-run Plan for item N alone**, using
   `plan-phase.md`'s mechanics (research, rewrite `PLAN.md` including a
   revisited Commits section if the split no longer makes sense). Stay scoped
   to item N in this step; downstream patching is next.

5. **Check downstream impact.** For every item M > N that consumes a contract
   item N produces, or otherwise depends on item N's design: does the re-plan
   change item N's contract shape, Boundaries, or Goal in a way that
   invalidates item M's plan? If yes, patch item M's `REQUIREMENTS.md`,
   `PLAN.md`, and the relevant `CONTRACTS.md` entry in place, and state what
   changed and why. If no, say so explicitly — don't leave it unstated just
   because nothing needed to change.

6. **Reconcile the working tree explicitly.** Decide whether the new plan
   builds on the failed attempt's partial changes, requires reverting them
   first, or needs a mix — and write that decision into the plan's Technical
   Context (this is what the orchestrator's "Resume after a re-plan" step
   reads to know where to start). Don't leave this implicit; a silent
   assumption here is exactly the kind of gap that caused the original
   failure.

7. **Run the annotation cycle** on the updated `REQUIREMENTS.md`/`PLAN.md`
   (and any patched downstream files) — the same `//` convention as every
   other phase.

8. **Gate → resume Execute.** On approval:
   - Delete `items/NN-<slug>/FAILURE.md` — its content is now stale (the plan
     changed to address it); the history stays in `EXECUTION-LOG.md` instead.
   - Append a `RE-PLAN` entry to `EXECUTION-LOG.md` summarizing what changed
     in item N, what (if anything) was patched downstream, and why.
   - Tell the user plainly:

     > Item <n> re-planned. Run `/clear` to start a fresh session, then read `<path>/EXECUTE.md` again — the orchestrator will see the cleared FAILURE.md and resume from item <n>'s first step under the updated plan.
