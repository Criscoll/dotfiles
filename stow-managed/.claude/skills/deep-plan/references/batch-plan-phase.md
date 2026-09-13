## Plan-all phase (batch mode)

The point of Plan-all is to turn every item's approved requirements into a
technical design durable enough for a fresh **orchestrator** session to execute
hands-off — dispatching each step to a sub-agent, reviewing the result, and
committing per item without further human involvement until it halts or finishes.

Read `references/model-tiers.md` before starting — every step you write needs a tier.

1. **Re-read `ROADMAP.md`, `CONTRACTS.md`, and every `items/NN-<slug>/REQUIREMENTS.md`
   from disk.** Resolve any Open Questions left in a REQUIREMENTS.md before
   planning on top of it — surface them with `AskUserQuestion`, batching across
   items. Then research technical decisions per item, the same way
   `plan-phase.md` step 2 does: extract concrete code-level context (import
   paths, signatures, file paths) as you go, and ask about a genuine fork the
   moment you hit it rather than only parking it `[OPEN]`.

2. **Make each contract in `CONTRACTS.md` concrete.** For every `C<n>`, replace
   the behavioural `Shape` with an exact path, symbol, and signature or schema,
   and fill in `Verify` — a concrete check the orchestrator can run later
   (a command, a grep, a type check) to confirm the contract actually holds
   before/after an item runs.

3. **Write each `items/NN-<slug>/PLAN.md`**, using the `plan-phase.md` template
   (Goal, Technical Context, Edge Cases, Key Decisions, Agent Tooling, Testing
   & Verification, Boundaries, Out of Scope, Reuse) with these batch-specific
   differences:

   - The header gains a contracts line: `> Contracts: produces C<n>, C<m>; consumes C<k>`
     (omit either half if empty), alongside the existing `> Roadmap item:` line.
   - `## Proposed Steps` and `## Todo` are **replaced** by `## Steps`, made of
     dispatch units — each one a self-contained brief for one sub-agent
     dispatch producing one reviewable diff:

     ```
     ### Step k — <title> · tier: <fast|standard|frontier> — <why this tier>
     - [ ] <task>
     - [ ] <task>
     Files: <exact paths this step may touch>
     Done when: <a concrete, runnable check>
     ```

     Size each step so a sub-agent could execute it from the brief alone,
     without needing to ask the orchestrator anything beyond a fork.
   - Optional `## Anticipated Forks` — divergences you can already foresee
     (e.g. "if the existing helper doesn't accept a callback, wrap it instead
     of modifying its signature"), each with a resolution decided in advance
     so the orchestrator doesn't have to reason about it live.
   - **`[quick]` items** get a compact `PLAN.md` instead of the full template:
     just Goal, Steps (same dispatch-unit format above), Testing &
     Verification, and Boundaries — no Technical Context, Edge Cases, Key
     Decisions, or Reuse sections.

4. **Cross-plan consistency pass**, done in this same session with every
   item's PLAN.md in context at once (this is the reason Plan-all plans the
   whole roadmap in one sitting rather than per item). Check:

   - every contract an item **consumes** is produced by an **earlier** item,
     and the consuming plan's assumed shape matches the producing plan's
     concrete shape from step 2;
   - when two items edit the same file, the plans agree on which runs first
     and that the second's steps still apply after the first's edits;
   - every step across every plan has both a `tier:` and a `Done when:`;
   - every item has a runnable Testing & Verification gate;
   - no item's Boundaries conflict with another's (e.g. one item's ✅ Always
     contradicts another's 🚫 Never).

   Fix anything you find in place, in the affected PLAN.md files, and report
   what you fixed and why.

5. **Run the annotation pass** across all PLAN.md files and CONTRACTS.md — same
   `//` convention as elsewhere. Any `[OPEN — needs your decision]` Key
   Decision is not left for annotation — settle it via `AskUserQuestion` right
   here, the same way `plan-phase.md` step 5 handles it.

6. **Gate → write EXECUTE.md and hand off.** When the user approves every plan:

   - **Collapse Key Decisions** in every PLAN.md — same rule as `plan-phase.md`
     step 6: drop the Option A/B menu, keep what was chosen, briefly why, and
     what was considered-and-rejected with the reason.
   - **Write `EXECUTE.md`** (template below) in the artifact directory, with
     absolute paths throughout and the tier lookup table copied in verbatim
     from `references/model-tiers.md`.
   - Tell the user plainly that EXECUTE.md is the orchestrator's whole
     protocol — it dispatches, reviews, gates, commits, and logs without
     further prompting, only stopping at a HALT condition or when finished.
   - Hand over the pointer prompt as a **fenced code block** (never a `>`
     blockquote — it copies clean):

     ```
     Read <abs-path>/EXECUTE.md in full, then follow its instructions exactly. Do not start until you've read the whole file.
     ```

   - **Recommend running the orchestrator on a frontier-tier model**, in a
     fresh session (`/clear` first) — it needs to judge forks and review diffs
     against plans it didn't write itself, which is exactly the frontier-tier
     use case from `model-tiers.md`.

---

## EXECUTE.md template (orchestrator protocol)

Fill this in with real absolute paths and the tier table when writing
`EXECUTE.md`. The orchestrator that reads this file runs it standalone — it
does not re-read this reference file, so nothing here may be left implicit.

````markdown
# Execute: <overall goal>

You are the orchestrator for a batch deep-plan roadmap. Your job is to
**dispatch, review, gate, commit, and log** — not to re-plan what the plans
already settled. Small review fixups of about 5 lines or fewer (e.g. a missing
import) may be done inline and logged; anything larger goes through the fork
process below.

Artifact directory: <abs-path>
- ROADMAP.md: <abs-path>/ROADMAP.md
- CONTRACTS.md: <abs-path>/CONTRACTS.md
- Items: <abs-path>/items/NN-<slug>/{REQUIREMENTS.md,PLAN.md}
- Log: <abs-path>/EXECUTION-LOG.md (append-only; create if missing)

## Model tiers

<tier lookup table copied verbatim from references/model-tiers.md>

## 0. Start or resume

1. Read ROADMAP.md, CONTRACTS.md, and EXECUTION-LOG.md (if it exists).
2. If the last EXECUTION-LOG.md entry is a HALT, report it to the user and
   stop — do not attempt to resolve it yourself.
3. Position = the first unchecked item in ROADMAP.md, then within it the
   first unchecked step in that item's PLAN.md.
4. Run `git status --porcelain`.
   - **Fresh start** (no EXECUTION-LOG.md yet): it must be clean. If not,
     HALT — unrelated uncommitted changes would leak into the first item's
     commit.
   - **Resume**: any uncommitted changes must match exactly the `Files:` of
     the step you're resuming mid-way through. If they don't, HALT — you
     cannot tell which changes belong to this run.

## Per item

1. **Check contracts consumed.** Run the `Verify` check for every contract
   this item consumes (from CONTRACTS.md), and spot-check the plan's Reuse
   entries against the current codebase. A mismatch counts as a fork — handle
   it via the Forks process below before dispatching any step.
2. **Dispatch each step** at the tier its PLAN.md names, using the `subagent`
   tool (pi) or the `Agent` tool (Claude Code) per the lookup table. Give the
   sub-agent a self-contained brief: the step's tasks verbatim, any Reuse
   entries the step needs, the item's Boundaries, the exact shape of any
   contract this step produces, `Files:`, `Done when:`, any skills the step
   should invoke, and an explicit instruction to report divergence rather than
   decide it.
3. **Review the result.** Wait for the sub-agent's report, then check its
   report and `git diff` against the step's tasks and the item's Boundaries,
   and run `Done when:` yourself.
   - **Accept** → tick the step's tasks in PLAN.md, log a DONE entry.
   - **Reject** → re-dispatch once with specific corrections. If the failure
     was about capability rather than unclear instructions, re-dispatch one
     tier up. Log the escalation either way.
4. **Run the item's Testing & Verification gate.** On failure, allow up to 2
   fix dispatches at the item's tier (or one tier up on the second attempt if
   the first fix attempt also failed to diagnose it), then HALT — this bound
   exists to stop thrashing on a problem that's actually in the plan, not the
   implementation.
5. **Check contracts produced.** Run the `Verify` check for every contract
   this item produces.
6. **Commit.** Stage only this item's files, by explicit path — never `-A` or
   a wildcard. Check the diff for secrets or runtime files before staging.
   Write a commit message that states what changed and why, on the current
   branch. Never create a new branch, push, or force-push.
7. **Tick the item** in ROADMAP.md and log an ITEM-DONE entry with the commit
   hash.

## Forks — decide, log, patch

1. Check the item's `## Anticipated Forks` first — if this divergence was
   foreseen, use its pre-decided resolution and skip straight to logging it.
2. Otherwise, choose the option most consistent with the item's REQUIREMENTS
   Goals and Boundaries and with CONTRACTS.md, preferring the smallest
   deviation from the plan that still resolves the divergence.
3. Log the fork in EXECUTION-LOG.md: what diverged, the options considered,
   the decision, and the reasoning.
4. If the fork changes a contract's shape, update CONTRACTS.md and patch
   every downstream PLAN.md that consumes it **before continuing past this
   item** — log each patch as its own EXECUTION-LOG.md entry.
5. **HALT instead of deciding** when: an ⚠️ Ask-first or 🚫 Never boundary
   would be crossed; a gate still fails after the 2-round fix bound above; or
   the fork invalidates an item's stated Goal rather than just its
   implementation detail.

## Finish

When every item is checked: run the roadmap's final overall gate if one is
named, write a summary EXECUTION-LOG.md entry (items completed, commits made,
forks decided, contracts patched, escalations), and report to the user.
Archiving the artifact directory is left to the next `/deep-plan` invocation.
**Never** push, force-push, rewrite history, or switch branches — those are
outside this protocol regardless of how the run went.

## EXECUTION-LOG.md entry format

```
## <ISO 8601 timestamp> — item <n> step <k> — DONE|FORK|PATCH|ESCALATE|HALT|ITEM-DONE
<2-5 lines: what happened, and for FORK/PATCH/ESCALATE/HALT, why>
```
````
