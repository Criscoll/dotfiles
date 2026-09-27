## EXECUTE.md template (orchestrator protocol)

Fill this in with real absolute paths and the effort-tier definitions when
writing `EXECUTE.md`. The orchestrator that reads this file runs it standalone
— it does not re-read this reference file, so nothing here may be left
implicit.

````markdown
# Execute: <overall goal>

You are the **orchestrator** for this roadmap. Your job is to **dispatch,
review, gate, commit, and log** — not to re-plan what the plans already
settled, and not to implement steps yourself. Every step in every PLAN.md
must be executed by a dispatched sub-agent, not inline by you — you review
and decide, sub-agents implement. Steps are dispatched in groups (see
Dispatch groups below), never inline. Small review fixups of about 5 lines or
fewer (e.g. a missing import) may be applied inline by you and logged;
anything larger goes through a fresh dispatch.

Artifact directory: <abs-path>
- ROADMAP.md: <abs-path>/ROADMAP.md
- CONTRACTS.md: <abs-path>/CONTRACTS.md
- Items: <abs-path>/items/NN-<slug>/{REQUIREMENTS.md,PLAN.md,FAILURE.md}
- Log: <abs-path>/EXECUTION-LOG.md (append-only; create if missing)

## Effort tiers

<tier definitions and dispatch guidance copied verbatim from references/model-tiers.md>

## Dispatch groups

Steps declare tiers individually, but **the dispatch unit is a group**: a run of consecutive
steps sharing a tier and a code surface, briefed to one sub-agent and reviewed as one diff.
Grouping only ever rounds a step up, never down. A group never spans a commit boundary.

| Item | Group | Steps | Tier | Surface |
| --- | --- | --- | --- | --- |
| <n> | <n>A | <k>–<m> | <tier> | <what this group touches> |

If a group turns out too large mid-run — the sub-agent reports it can't hold the whole brief,
or the diff is unreviewable — split it at a step boundary and log a FORK. Never merge two
groups, and never split a group across a commit.

## Item-specific tripwires

Places where a plausible-looking diff is wrong and nothing would fail. Check each one explicitly
when reviewing the named step, and include it in that group's brief.

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
   - **Resume after a normal pause** (no pending FAILURE.md): any uncommitted
     changes must match exactly the `Files:` of the step you're resuming
     mid-way through. If they don't, treat it as a failure (see below) —
     you cannot tell which changes belong to this run.
   - **Resume after a re-plan** (EXECUTION-LOG.md's last entry for this item
     is RE-PLAN): trust the re-plan's stated decision about the working tree
     in the updated PLAN.md's Technical Context — it already reconciled
     whatever the failed attempt left behind. Start this item's steps fresh
     from the top unless the re-plan says otherwise.

## Per item

1. **Check contracts consumed.** Run the `Verify` check for every contract
   this item consumes (from CONTRACTS.md), and spot-check the plan's Reuse
   entries against the current codebase. A mismatch counts as a fork — handle
   it via the Forks process below before dispatching any step.
2. **Dispatch each group** from the Dispatch groups table — not each step
   individually — using the `subagent` tool (pi) or the `Agent` tool (Claude
   Code), at the group's tier, picking a concrete model per
   `model-tiers.md`'s dispatch guidance. Give the sub-agent a self-contained
   brief covering **every step in the group**: each step's tasks verbatim, any
   Reuse entries those steps need, the item's Boundaries, the exact shape of
   any contract the group produces, the union of the steps' `Files:`, every
   step's `All sites:` command and `Done when:`, any tripwires on these steps,
   and any skills to invoke. Include the absolute paths to the item's
   REQUIREMENTS.md and PLAN.md, with an instruction to read both in full for
   context but implement only this group's steps — a sub-agent that sees only
   its fragment of the plan can complete every task and still miss the
   requirement those tasks serve.

   The brief must also require that **any divergence is reported as an open
   question with a recommendation, never as a settled decision**, in the form
   *"I did X. The plan implied Y. I recommend X because Z — confirm or
   correct."* — and that the report lists every assumption the sub-agent made
   about code outside its group (e.g. where a later step will mount something).
3. **Review the result.** Wait for the sub-agent's report, then check its
   report and `git diff` against **every** step's tasks in the group, the
   item's Boundaries, and any tripwire on these steps.
   - Run each step's `Done when:` yourself. For a `Done when (review):`,
     confirm the diff shows what it names.
   - Re-run each `All sites:` command and account for every hit — changed,
     or excluded for a stated reason. A change that lands at some but not all
     sites passes every other check.
   - Treat framing like "deliberate simplification", "scoped decision", or
     "judgement call" as an unreviewed divergence: the sub-agent decided
     something it was told to surface. Check it against REQUIREMENTS.md
     yourself before accepting it.
   - Check every assumption the report made about code outside the group
     against the plan for that code now. A mismatch is a fork.
   - **Accept** → tick all of the group's step tasks in PLAN.md, log a DONE
     entry naming the group.
   - **Reject** → re-dispatch once with specific corrections. **Scope the
     re-dispatch to the failing step, or the specific task within it**, not
     the whole group — the rest already passed its `Done when:`. If the
     failure was about capability rather than unclear instructions,
     re-dispatch one tier up. Log the escalation either way.
4. **Review the whole item against REQUIREMENTS.md.** Once every group has
   landed, go through each numbered Validated Requirement and find where the
   item's whole change (including any of its commits already landed)
   satisfies it. Group reviews compare diffs to the plan; this compares the
   result to what the plan was for. Some gaps only show once every group is
   in — a behaviour wired into one of two parallel renderers passes each
   group's review and every gate. A requirement with no answer in the change
   is a gap: if the diff departed from the plan, handle it as a rejection
   (step 3); if the diff followed the plan and the plan fell short, handle it
   as a fork.
5. **Run the item's Testing & Verification gate.** On failure, allow up to
   **2 fix dispatches**. Checks under the plan's `## Human verification` are
   not part of the gate — don't run them or block on them; carry them to
   Finish.

   Tiers are declared per step and dispatched per group — there is no "item
   tier". Pick the fix-dispatch tier like this:

   - **First fix dispatch:** the tier of the group whose `Files:` the failure
     points at, scoped to that group's steps. If the failure spans groups or
     the cause is ambiguous, use the highest tier among that item's groups.
   - **Second fix dispatch:** one tier up from the first, capped at Deep
     Thinking.

   If the gate still fails after that bound, **this is a failure, not a fork**
   — go to the Failures section below rather than attempting a third fix. That
   bound exists specifically to stop thrashing on a problem that's actually in
   the plan, not the implementation.
6. **Check contracts produced.** Run the `Verify` check for every contract
   this item produces.
7. **Commit.** Follow the item's PLAN.md `## Commits` section — a single
   commit by default, or the declared multi-commit split, landed in the order
   given. For each commit, stage only the files belonging to that commit, by
   explicit path — never `-A` or a wildcard. Check the diff for secrets or
   runtime files before staging. Write a commit message that states what
   changed and why, on the current branch. Never create a new branch, push, or
   force-push.
8. **Tick the item** in ROADMAP.md and log an ITEM-DONE entry with the commit
   hash(es).

## Forks — decide, log, patch

1. Check the item's `## Anticipated Forks` first. If this divergence was
   foreseen **and its stated premise still holds** in the code as it is now,
   use its pre-decided resolution and skip straight to logging it. If the
   premise no longer holds — often because an earlier item changed what it
   rested on — treat the divergence as unforeseen.
2. Otherwise, choose the option most consistent with the item's REQUIREMENTS
   Goals and Boundaries and with CONTRACTS.md, preferring the smallest
   deviation from the plan that still resolves the divergence.
3. Log the fork in EXECUTION-LOG.md: what diverged, the options considered,
   the decision, and the reasoning.
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
still fails after the fix-dispatch bound, a fork that would cross an
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
   Steps dispatched, at what tier, and their outcomes.

   ## What failed
   The actual gate/error output or the boundary/Goal that would have been
   crossed. Not a paraphrase — paste the real output.

   ## Root-cause theory
   Your best current theory: a wrong assumption in the plan, a transient issue
   worth re-checking, missing context, or a genuine plan gap. Say which, and
   why you believe it.

   ## Working-tree state
   Output of `git status --porcelain` and a summary of any uncommitted diff,
   so the re-plan knows what it's building on top of.

   ## Recommendation for re-plan
   What you'd point the re-plan at first — not a decision, a pointer.
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
forks decided, contracts patched, escalations), and report to the user.
List every `## Human verification` check from the completed items' plans, and
any gate approximation a plan flagged as partial, explicitly as **outstanding**
— the user is the only one who can close them.
Archiving the artifact directory is left to the next `/deep-plan` invocation.
**Never** push, force-push, rewrite history, or switch branches — those are
outside this protocol regardless of how the run went.

## EXECUTION-LOG.md entry format

```
## <ISO 8601 timestamp> — item <n> group <gid>|step <k> — DONE|FORK|PATCH|ESCALATE|HALT-FAILURE|RE-PLAN|ITEM-DONE
<2-5 lines: what happened, and for FORK/PATCH/ESCALATE/HALT-FAILURE/RE-PLAN, why>
```
````
