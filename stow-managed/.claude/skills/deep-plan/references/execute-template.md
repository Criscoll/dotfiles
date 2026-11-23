## EXECUTE.md template (executor protocol)

Fill this in with real absolute paths when writing `EXECUTE.md`. The executor
that reads this file runs it standalone — it does not re-read this reference
file, so nothing here may be left implicit.

````markdown
# Execute: <overall goal>

You are the **sole executor** for this roadmap: you implement every step
yourself, in order, in this one session, then review your own work against
the plan, gate, commit, and log. There are no sub-agents. You run on whatever
model the user started this session on; steps marked `strong` in the groups
table are the exception (see Strong-model handoffs). You are not independent of
your own changes, so the checks below are deliberately mechanical — run them
and read their output; don't rely on remembering that you did it right. Don't
re-plan what the plans already settled. If the session grows long, the log and
ticked PLAN.md steps are durable: the user can `/clear` and have you resume
from section 0.

Artifact directory: <abs-path>
- ROADMAP.md: <abs-path>/ROADMAP.md
- CONTRACTS.md: <abs-path>/CONTRACTS.md
- Items: <abs-path>/items/NN-<slug>/{REQUIREMENTS.md,PLAN.md,FAILURE.md}
- Diff files: <abs-path>/items/NN-<slug>/review/<gid>-diff.md
- Review-package script: <abs-path-to-skill>/scripts/review-package (written
  `<review-package>` below)
- Log: <abs-path>/EXECUTION-LOG.md (append-only; create if missing)

## Groups

A group is a run of consecutive steps sharing a model (`worker` or `strong`)
and a code surface. It is the **review unit**: you implement its steps, then
review that group's diff before moving on. A group never spans a commit
boundary, and `worker` and `strong` steps are never in the same group.

| Item | Group | Steps | Model | Surface |
| --- | --- | --- | --- | --- |
| <n> | <n>A | <k>–<m> | <worker|strong> | <what this group touches> |

If a group turns out too large mid-run — the diff is unreviewable — split it at
a step boundary and log a FORK. Never merge two groups, and never split a group
across a commit.

## Item-specific tripwires

Places where a plausible-looking diff is wrong and nothing would fail. Check each one explicitly
when reviewing the named step.

- **Item <n>, step <k>** — <what must be true> · <why nothing fails if it isn't> · <the command
  or read that exposes it>

## 0. Start or resume

1. Read ROADMAP.md, CONTRACTS.md, and EXECUTION-LOG.md (if it exists).
2. **Check every `items/NN-<slug>/FAILURE.md`.** If any exists, the roadmap is
   halted on that item pending a human-approved re-plan — report it to the
   user (its Goal, what failed, one-line root cause) and stop. Do not attempt
   to resolve it yourself, and do not skip past that item to a later one.
3. Position = the first unchecked item in ROADMAP.md, then within it the
   first unchecked step in that item's PLAN.md.
4. Run `git status --porcelain`.
   - **Fresh start** (no EXECUTION-LOG.md yet): it must be clean. If not,
     write a FAILURE.md for item 1 (see the Failures section) explaining the
     dirty tree and stop — unrelated uncommitted changes would leak into the
     first item's commit.
   - **Resume after a normal pause or handoff** (no pending FAILURE.md): any
     uncommitted changes must match exactly the `Files:` of the steps already
     ticked in the item you're resuming mid-way through. If they don't, treat
     it as a failure (see below) — you cannot tell which changes belong to
     this run.
   - **Resume after a re-plan** (EXECUTION-LOG.md's last entry for this item
     is RE-PLAN): trust the re-plan's stated decision about the working tree
     in the updated PLAN.md's Technical Context — it already reconciled
     whatever the failed attempt left behind. Start this item's steps fresh
     from the top unless the re-plan says otherwise.

## Per item

1. **Check contracts consumed.** Run the `Verify` check for every contract
   this item consumes (from CONTRACTS.md), and spot-check the plan's Reuse
   entries against the current codebase. A mismatch counts as a fork — handle
   it via the Forks process below before implementing any step.
2. **Implement each group**, in table order. For each group:

   a. **If its Model is `strong`, apply Strong-model handoffs (below) before
      anything else.**
   b. `BASE=$(<review-package> snapshot)`.
   c. Read the group's steps in PLAN.md, the item's REQUIREMENTS.md, the
      Reuse entries and Boundaries, and any tripwires named for these steps.
      Implement the tasks, staying within the steps' `Files:`.
   d. **Review as if someone else wrote it.** Build the diff:
      `<review-package> diff $BASE <abs-path>/items/NN-<slug>/review/<gid>-diff.md <each path in the group's Files:>`.
      Any file flagged outside `Files:` is a Boundaries question — settle it
      before continuing. Then **read the diff file**, not your memory of what
      you wrote, and check it against every step's tasks, the Boundaries and
      the tripwires. Run each step's `Done when:` and read the actual output;
      for a `Done when (review):`, confirm the diff shows what it names.
      Re-run each `All sites:` command and account for every hit — changed,
      or excluded for a stated reason.
   e. Anywhere you departed from the plan is a divergence: settle it with the
      Forks process (log it) rather than leaving it implicit.
   f. Tick the group's step tasks in PLAN.md and log a DONE entry naming the
      group. If a fix is needed, make it and redo (d) — at most 2 rounds per
      group, then it's a failure.
3. **Review the whole item against REQUIREMENTS.md.** Once every group has
   landed, go through each Validated Requirement by ID (`R1`, `R2`, …) —
   starting from the steps whose `Serves:` cites it — and find where the
   item's whole change (including any of its commits already landed)
   satisfies it. Group reviews compare diffs to the plan; this compares the
   result to what the plan was for. Some gaps only show once every group is
   in — a behaviour wired into one of two parallel renderers passes each
   group's review and every gate. A requirement with no answer in the change
   is a gap: if the diff departed from the plan, fix it (back in step 2d); if
   the diff followed the plan and the plan fell short, handle it as a fork.
4. **Run the item's Testing & Verification gate.** Checks under the plan's
   `## Human verification` are not part of the gate — don't run them or block
   on them; carry them to Finish. On failure, make up to **2 fix attempts**,
   reading the gate's actual failing output each time. If the gate still fails,
   **this is a failure, not a fork** — go to the Failures section rather than
   attempting a third fix. That bound exists specifically to stop thrashing on
   a problem that's actually in the plan, not the implementation.
5. **Check contracts produced.** Run the `Verify` check for every contract
   this item produces.
6. **Commit.** Follow the item's PLAN.md `## Commits` section — a single
   commit by default, or the declared multi-commit split, landed in the order
   given. For each commit, stage only the files belonging to that commit, by
   explicit path — never `-A` or a wildcard. Check the diff for secrets or
   runtime files before staging. Write a commit message that states what
   changed and why, on the current branch. Never create a new branch, push, or
   force-push.
7. **Tick the item** in ROADMAP.md and log an ITEM-DONE entry with the commit
   hash(es).

## Strong-model handoffs

A group marked `strong` was flagged by the planner as hard to get right and
hard to notice when wrong. The user chooses the model for each session, so you
cannot switch yourself — you stop and hand over. This is a normal pause, not a
failure: no FAILURE.md.

**Before implementing a `strong` group**, check two things: the last
EXECUTION-LOG.md entry, and whether the prompt that started this session said
you are the strong-model session for that group.

- **Not the strong session** (the usual case): append a HANDOFF entry naming
  the group and why it was flagged — unless the log's last entry is already
  that HANDOFF, in which case don't duplicate it. Then stop and tell the user
  to start a fresh session on a strong model with this prompt, filled in with
  the real path and group id:

  ```
  Read <abs-path>/EXECUTE.md in full. You are the strong-model session for group <gid>: implement and review only that group (section 2 of "Per item"), tick its steps, log DONE, then stop. Do not continue to later groups, run the item gate, or commit.
  ```

  Then they switch back to the worker model and re-run the pointer prompt to
  resume.
- **The strong session** (prompt names this group, last log entry is its
  HANDOFF): implement and review the group exactly as in step 2, log DONE, and
  **stop**. Don't run the gate, commit, or touch later groups — the worker
  session continues from the ticked steps.

## Forks — decide, log, patch

1. Check the item's `## Anticipated Forks` first. If this divergence was
   foreseen **and its stated premise still holds** in the code as it is now,
   use its pre-decided resolution and skip straight to logging it. If the
   premise no longer holds — often because an earlier item changed what it
   rested on — treat the divergence as unforeseen.
2. Otherwise, choose the option most consistent with the item's REQUIREMENTS
   Goals and Boundaries and with CONTRACTS.md, preferring the smallest
   deviation from the plan that still resolves the divergence.
3. Log the fork in EXECUTION-LOG.md: what diverged and the options
   considered, then the decision as one line —
   `Ruling: <what you decided> — <why> — if wrong: <what it costs and how to undo it>`.
   The "if wrong" clause is for the user reading the log afterwards: it tells
   them which rulings deserve a second look.
4. If the fork touches a contract:
   - **Widening** — purely additive; every existing consumer compiles and
     behaves identically. Append a dated note to the contract in
     CONTRACTS.md saying what was added and why it is additive, and log a
     PATCH entry. Downstream PLAN.md files don't need patching.
   - **Changing or narrowing** — a member's type, name, or semantics moved.
     Update CONTRACTS.md **and** patch every downstream PLAN.md that consumes
     it **before continuing past this item**, logging each patch as its own
     EXECUTION-LOG.md entry.
   - If you can't tell which it is, treat it as changing.
5. **This is a failure, not a decision you make, when:** an ⚠️ Ask-first or
   🚫 Never boundary would be crossed, or the fork invalidates an item's
   stated Goal rather than just its implementation detail. Go to Failures.

## Failures — document, halt, wait

A failure is anything you cannot resolve within this protocol: a gate that
still fails after the fix-attempt bound, a fork that would cross an
Ask-first/Never boundary or invalidate the item's Goal, or state you can't
reconcile (e.g. a dirty tree at a fresh start). You do not guess your way past
a failure and you do not keep retrying — you gather the facts, write them
down, and stop. Getting the roadmap moving again is the user's call, made
after they've read what you wrote.

1. **Gather the facts** before writing anything: the actual gate/error output
   (not a paraphrase), which steps were attempted and their outcomes, what
   fix or fork options were tried or considered and why each didn't resolve
   it, and the current `git status`/`git diff` state.
2. **Write `items/NN-<slug>/FAILURE.md`:**

   ```
   # Failure: <item title>

   > Roadmap item: <n> — <title>
   > Halted: <ISO 8601 timestamp>

   ## What was attempted
   Steps implemented and their outcomes, and which model ran them.

   ## What failed
   The actual gate/error output or the boundary/Goal that would have been
   crossed. Not a paraphrase — paste the real output.

   ## Root-cause theory
   Your best current theory: a wrong assumption in the plan, a transient issue
   worth re-checking, missing context, a genuine plan gap, or a step that
   needed a stronger model than the worker. Say which, and why you believe it.

   ## Working-tree state
   Output of `git status --porcelain` and a summary of any uncommitted diff,
   so the re-plan knows what it's building on top of.

   ## Recommendation for re-plan
   What you'd point the re-plan at first — not a decision, a pointer. If the
   cause looks like model capability, say which step the re-plan should flag
   `Needs strong model`.
   ```

3. **Append a HALT-FAILURE entry** to EXECUTION-LOG.md referencing the file.
4. **Tell the user plainly**, in your final message: which item halted, the
   one-line reason, and that re-starting requires them to review FAILURE.md
   and explicitly ask to re-plan that item (`references/replan-phase.md`) —
   you do not resume or re-plan on your own initiative.
5. Stop. Do not touch later items, do not keep attempting fixes, and do not
   revert the working tree unless leaving it as-is would itself violate a
   Boundary — if you do revert, say so in FAILURE.md.

## Finish

When every item is checked: run the roadmap's final overall gate if one is
named, write a summary EXECUTION-LOG.md entry (items completed, commits made,
forks decided, contracts patched, handoffs), and report to the user.
List every `## Human verification` check from the completed items' plans, and
any gate approximation a plan flagged as partial, explicitly as **outstanding**
— the user is the only one who can close them.

Because you reviewed your own work, suggest an independent check: a fresh
session on a strong model that reviews the run's commits against each item's
REQUIREMENTS.md and the rulings in EXECUTION-LOG.md. Give them this prompt,
with real paths filled in:

```
Read <abs-path>/ROADMAP.md, CONTRACTS.md and EXECUTION-LOG.md, then review the commits the log lists against each item's REQUIREMENTS.md. Report gaps and any FORK rulings you disagree with. Do not change code.
```

Archiving the artifact directory is left to the next `/deep-plan` invocation.
**Never** push, force-push, rewrite history, or switch branches — those are
outside this protocol regardless of how the run went.

## EXECUTION-LOG.md entry format

```
## <ISO 8601 timestamp> — item <n> group <gid>|step <k> — DONE|FORK|PATCH|HANDOFF|HALT-FAILURE|RE-PLAN|ITEM-DONE
<2-5 lines: what happened, and for FORK/PATCH/HANDOFF/HALT-FAILURE/RE-PLAN, why.
FORK entries end with their `Ruling:` line.>
```
````
