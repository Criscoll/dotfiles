## Plan phase

The point of Plan is to turn every item's approved requirements into a
technical design durable enough for a fresh **orchestrator** session to
execute hands-off — dispatching each step to a sub-agent, reviewing the
result, and committing per item without further human involvement until it
halts or finishes.

Read `references/model-tiers.md` before starting — every step you write needs
an effort tier.

1. **Re-read `ROADMAP.md`, `CONTRACTS.md`, and every `items/NN-<slug>/REQUIREMENTS.md`
   from disk.** Resolve any Open Questions left in a REQUIREMENTS.md before
   planning on top of it — surface them with `AskUserQuestion`, batching across
   items. Then research technical decisions per item: extract concrete
   code-level context (import paths, signatures, file paths) as you go, and
   ask about a genuine fork the moment you hit it rather than only parking it
   `[OPEN]`.

2. **Make each contract in `CONTRACTS.md` concrete.** For every `C<n>`, replace
   the behavioural `Shape` with an exact path, symbol, and signature or schema,
   and fill in `Verify` — a concrete check the orchestrator can run later
   (a command, a grep, a type check) to confirm the contract actually holds
   before/after an item runs.

3. **Write each `items/NN-<slug>/PLAN.md`** with this structure:

```
# Plan: <item title>

> Roadmap item: <n> — <title>   (must match REQUIREMENTS.md and ROADMAP.md)
> Contracts: produces C<n>, C<m>; consumes C<k>   (omit either half if empty)

## Goal
One or two sentences — what this plan sets out to accomplish. The first thing
the reader sees, so the plan is scannable standalone. An orientation line, not
a re-statement of REQUIREMENTS.md's Goals.

## Technical Context
Brief — what you read to choose the approach, and the key constraints that
shaped it. Reference REQUIREMENTS.md rather than restating it.

## Edge Cases
Scenarios that break a naive solution. Name the specific input/state/condition,
not just "error handling". If you genuinely can't think of any, say so.

## Key Decisions
A review surface for the annotation cycle. For each decision point:
- **Status:** `[OPEN — needs your decision]` / `[recommended: <option>]` / `[decided: <option>]`
- **Option A** — what it is, trade-offs
- **Option B** — what it is, trade-offs
- **Recommendation** (if confident), else leave the status OPEN for the user to choose.

If ANY decision is `[OPEN]`, the annotation handback enumerates them and asks the
user to resolve them — the plan does NOT hand off to Execute with open decisions.
On approval this section COLLAPSES (see Gate step): the Option A/B menu is dropped,
but each decision keeps a short record — what was chosen, briefly why, and what was
considered-and-rejected with the reason. That reasoning trail is context the
implementer needs, not noise.

## Agent Tooling
Skills or extensions the implementing sub-agent must explicitly invoke:
- `<skill-name>` — why the executor needs it
(Omit this section only if no skills or extensions are relevant.)

## Steps
Dispatch units — each one a self-contained brief for one sub-agent dispatch
producing one reviewable diff. Size each step so a sub-agent could execute it
from the brief alone, without needing to ask the orchestrator anything beyond
a fork.

### Step k — <title> · effort: <Lightweight|Moderate Thinking|Deep Thinking> — <why this tier>
- [ ] <task>
- [ ] <task>
Files: <exact paths this step may touch>
Done when: <a concrete, runnable check>

## Anticipated Forks (optional)
Divergences you can already foresee (e.g. "if the existing helper doesn't
accept a callback, wrap it instead of modifying its signature"), each with a
resolution decided in advance so the orchestrator doesn't have to reason about
it live.

## Commits
Default: this item lands as a **single commit** once its verification gate
passes. Only split into multiple commits when there's a concrete reason (e.g.
two genuinely separable concerns, or a diff large enough that one reviewable
commit would bury the other change) — name each commit, what it contains, and
which steps/files belong to it, in the order they should land. Most items
should just say "single commit."

## Testing & Verification
How the orchestrator will know each step, and the item as a whole, works. Name
the test framework and where tests live, the specific cases worth covering
(not just "add tests"), and the verification gate the whole item must pass
before it's committed (e.g. typecheck && lint && test && build). If the change
isn't testable in the usual way, say how it will be verified instead.

Two verification anti-patterns to call out in the plan when relevant:

- **Verify scope:** When the plan wraps or instruments existing behavior (logging,
  caching, metrics), scope verification to the new behavior only. Do not re-verify
  the underlying logic — it wasn't changed and wasn't a regression risk.

- **Executor self-interference:** If a dispatched sub-agent runs inside an
  environment with its own input guards (hooks, extensions), verification
  commands that embed a guarded pattern — even as a quoted string or JSON
  fixture — may be silently intercepted. When this risk exists, note it and
  prefer reading side-effects (log files, state files) over synthesizing
  matching inputs.

## Boundaries
Behavioral guardrails for the implementer, in three tiers:
- **✅ Always** — invariants the implementation must uphold
- **⚠️ Ask first** — changes that require checking with the user before proceeding (the orchestrator treats these as a HALT, not a decision it can make itself)
- **🚫 Never** — things the implementation must not do

## Out of Scope
What this item's plan explicitly does NOT address.

## Reuse
Concrete code-level context the implementer needs at their fingertips — distilled from reading reference files, docs, and APIs during the Research step. Capture:
- **Import paths** — every package to import from and what to import. E.g. `@earendil-works/pi-tui` → `{ Container, Text, Markdown, matchesKey, Key, CURSOR_MARKER }`
- **Function/class/interface signatures** — the exact types and shapes. E.g. `complete(model, { systemPrompt, messages }, { apiKey, headers, signal })` returns `{ stopReason, content[] }`
- **API contracts** — methods and their signatures. E.g. `ctx.ui.custom<T>(factory, opts?) → Promise<T>`, `ctx.modelRegistry.getApiKeyAndHeaders(model) → { ok, apiKey, headers, error }`
- **Reference files** — which existing files demonstrate the required pattern and what pattern each shows. E.g. `handoff.ts` → pattern for `ctx.ui.custom(...)` + `BorderedLoader` + `complete()`
- **Gotchas** — non-obvious patterns or pitfalls. E.g. multiple `toolResult` messages each get their own message, Focusable interface needs IME support via CURSOR_MARKER
Do NOT paste entire files — just the skeleton and signatures needed to write the implementation.
```

   **`[quick]` items** get a compact `PLAN.md` instead of the full template:
   just Goal, Steps (same dispatch-unit format above), Commits, Testing &
   Verification, and Boundaries — no Technical Context, Edge Cases, Key
   Decisions, or Reuse sections. They still get dispatched by the
   orchestrator exactly like any other item.

4. **Cross-plan consistency pass**, done in this same session with every
   item's PLAN.md in context at once (this is the reason Plan plans the whole
   roadmap in one sitting rather than per item). Check:

   - every contract an item **consumes** is produced by an **earlier** item,
     and the consuming plan's assumed shape matches the producing plan's
     concrete shape from step 2;
   - when two items edit the same file, the plans agree on which runs first
     and that the second's steps still apply after the first's edits;
   - every step across every plan has both an effort tier and a `Done when:`;
   - every item has a runnable Testing & Verification gate and a Commits section;
   - no item's Boundaries conflict with another's (e.g. one item's ✅ Always
     contradicts another's 🚫 Never).

   Fix anything you find in place, in the affected PLAN.md files, and report
   what you fixed and why.

5. **Run the annotation pass** across all PLAN.md files and CONTRACTS.md — same
   `//` convention as elsewhere. Any `[OPEN — needs your decision]` Key
   Decision is not left for annotation — settle it via `AskUserQuestion` right
   here.

6. **Gate → write EXECUTE.md and hand off.** When the user approves every plan:

   - **Collapse Key Decisions** in every PLAN.md: drop the Option A/B menu,
     keep what was chosen, briefly why, and what was considered-and-rejected
     with the reason.
   - **Write `EXECUTE.md`** (template below) in the artifact directory, with
     absolute paths throughout and the effort-tier definitions copied in
     verbatim from `references/model-tiers.md`.
   - Tell the user plainly that EXECUTE.md is the orchestrator's whole
     protocol — it dispatches, reviews, gates, commits, and logs without
     further prompting, only stopping to write a failure report and halt, or
     when finished.
   - Hand over the pointer prompt as a **fenced code block** (never a `>`
     blockquote — it copies clean):

     ```
     Read <abs-path>/EXECUTE.md in full, then follow its instructions exactly. Do not start until you've read the whole file.
     ```

   - **Recommend running the orchestrator at the Deep Thinking tier**, in a
     fresh session (`/clear` first) — it needs to judge forks and review diffs
     against plans it didn't write itself, which is exactly the Deep Thinking
     use case from `model-tiers.md`.

---

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
and decide, sub-agents implement. Small review fixups of about 5 lines or
fewer (e.g. a missing import) may be applied inline by you and logged;
anything larger goes through a fresh dispatch.

Artifact directory: <abs-path>
- ROADMAP.md: <abs-path>/ROADMAP.md
- CONTRACTS.md: <abs-path>/CONTRACTS.md
- Items: <abs-path>/items/NN-<slug>/{REQUIREMENTS.md,PLAN.md,FAILURE.md}
- Log: <abs-path>/EXECUTION-LOG.md (append-only; create if missing)

## Effort tiers

<tier definitions and dispatch guidance copied verbatim from references/model-tiers.md>

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
2. **Dispatch each step** at the effort tier its PLAN.md names, using the
   `subagent` tool (pi) or the `Agent` tool (Claude Code), picking a concrete
   model per `model-tiers.md`'s dispatch guidance. Give the sub-agent a
   self-contained brief: the step's tasks verbatim, any Reuse entries the step
   needs, the item's Boundaries, the exact shape of any contract this step
   produces, `Files:`, `Done when:`, any skills the step should invoke, and an
   explicit instruction to report divergence rather than decide it.
3. **Review the result.** Wait for the sub-agent's report, then check its
   report and `git diff` against the step's tasks and the item's Boundaries,
   and run `Done when:` yourself.
   - **Accept** → tick the step's tasks in PLAN.md, log a DONE entry.
   - **Reject** → re-dispatch once with specific corrections. If the failure
     was about capability rather than unclear instructions, re-dispatch one
     tier up. Log the escalation either way.
4. **Run the item's Testing & Verification gate.** On failure, allow up to 2
   fix dispatches at the item's tier (or one tier up on the second attempt if
   the first fix attempt also failed to diagnose it). If the gate still fails
   after that bound, **this is a failure, not a fork** — go to the Failures
   section below rather than attempting a third fix. That bound exists
   specifically to stop thrashing on a problem that's actually in the plan,
   not the implementation.
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
Archiving the artifact directory is left to the next `/deep-plan` invocation.
**Never** push, force-push, rewrite history, or switch branches — those are
outside this protocol regardless of how the run went.

## EXECUTION-LOG.md entry format

```
## <ISO 8601 timestamp> — item <n> step <k> — DONE|FORK|PATCH|ESCALATE|HALT-FAILURE|RE-PLAN|ITEM-DONE
<2-5 lines: what happened, and for FORK/PATCH/ESCALATE/HALT-FAILURE/RE-PLAN, why>
```
````
