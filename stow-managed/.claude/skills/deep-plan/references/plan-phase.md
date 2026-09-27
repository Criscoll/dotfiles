## Plan phase

The point of Plan is to turn every item's approved requirements into a
technical design durable enough for a fresh **orchestrator** session to
execute hands-off — dispatching steps to sub-agents in tier-and-surface
groups, reviewing the result, and committing per item without further human
involvement until it halts or finishes.

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
   and fill in `Verify` — a runnable check the orchestrator uses before and
   after an item runs to confirm the contract's **promised behaviour** holds,
   not merely that its symbols exist. A grep for a type member is a presence
   check: it passes even when the mechanism the contract describes is broken,
   so it may supplement a behavioural check but never stands alone. If the
   contract makes a causal claim ("X takes precedence over Y", "ordering keeps
   Z out"), `Verify` must include a test asserting the **negative** — that Y
   does *not* win — because the positive case tends to pass by accident.

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

Any claim here or in Key Decisions about *why* something works — precedence,
ordering, shadowing, lifecycle, short-circuiting — carries a `file:line`
citation showing it, or becomes a test in the step that relies on it. Such
claims read like facts but can only be checked by reasoning about execution,
which makes them the ones most likely to be false.

## Edge Cases
Scenarios that break a naive solution. Name the specific input/state/condition,
not just "error handling". Also ask what must *re-run*, and what triggers it —
effects, subscriptions, caches, listeners, pollers: name the thing that changes
and the thing that must observe the change. Something that fires once on mount
but must fire again later is the most common silent defect of this kind. If
you genuinely can't think of any edge cases, say so.

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
Self-contained briefs a sub-agent can execute and review on its own. Size each
step so a sub-agent could execute it from the brief alone, without needing to
ask the orchestrator anything beyond a fork. (The orchestrator dispatches
steps in groups — consecutive steps sharing a tier and code surface — per the
Dispatch groups section of EXECUTE.md, so keep each step individually
reviewable too.)

### Step k — <title> · effort: <Lightweight|Moderate Thinking|Deep Thinking> — <why this tier>
- [ ] <task>
- [ ] <task>
Files: <exact paths this step may touch>
All sites: <command that enumerates every place this change must land>   (only when there's more than one)
Done when: <a runnable check that fails if the step's behaviour is absent>

`Files:` is a permission boundary; `All sites:` is a completeness one. Include
it whenever a step changes a pattern that exists in more than one place —
parallel renderers, compact and desktop layouts, every call site of a
signature, each branch of a mode switch. A change that lands at some but not
all sites is the most common silent failure in this workflow. Name the
command, not the list, so the orchestrator can re-run it against the code as
it actually is and account for every hit. Don't pin an expected count —
counts are easy to get wrong (`rg -c` counts lines, not matches), and a wrong
number reads as authoritative.

`Done when:` must fail on an empty implementation. Typecheck, lint, and "the
item gate passes" are preconditions — name them if you like, but they never
satisfy this field alone. Watch wiring steps (mounting components, threading
props, registering handlers) most closely: their check tends to degrade to a
typecheck, and that is where silent defects land. If no runnable command can
observe the behaviour, write `Done when (review): <what the diff must show>`
instead — the orchestrator confirms it by reading the diff, which is honest
where a typecheck standing in for it is not.

## Anticipated Forks (optional)
Divergences you can already foresee (e.g. "if the existing helper doesn't
accept a callback, wrap it instead of modifying its signature"), each with a
resolution decided in advance so the orchestrator doesn't have to reason about
it live. State each one's **premise** — especially one resting on an earlier
item's implementation detail — so the orchestrator can confirm it still holds
before applying the resolution, rather than applying one whose basis has
since changed.

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

Every check in the gate must be runnable by a headless orchestrator — no
browser, no GUI, no interactive session, no starting long-running services.
A gate it can't execute gets either skipped quietly or halts a finished item.
When a requirement can't be verified that way, put the closest automated
approximation in the gate, say in one line what it does and doesn't cover,
and list the human-only check under `## Human verification`.

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

## Human verification (optional)
Checks only a person can perform — visual inspection, profiler runs, on-device
testing. The orchestrator never runs these and never blocks on them; it
reports them to the user at the end of the run as outstanding.

## Boundaries
Behavioral guardrails for the implementer, in three tiers:
- **✅ Always** — invariants the implementation must uphold
- **⚠️ Ask first** — changes that require checking with the user before proceeding (the orchestrator treats these as a HALT, not a decision it can make itself)
- **🚫 Never** — things the implementation must not do

When a Boundary restricts a contract's surface, say whether *additive* changes
are permitted — "don't extend C4" and "don't extend C4 except additively" are
different rules, and the orchestrator would otherwise have to guess.

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
   Verification (plus Human verification if any), and Boundaries — no
   Technical Context, Edge Cases, Key
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
   - every `Done when:` and every contract `Verify` would actually fail if the
     behaviour it guards were absent — greps that count occurrences are the
     usual offender; replace them with a behavioural check, or with
     `Done when (review):` if nothing runnable can observe it;
   - every step that changes a multi-site pattern has an `All sites:`
     command, including each parallel implementation Refine recorded in
     What We Know;
   - every item has a runnable Testing & Verification gate that a headless
     orchestrator can execute, and a Commits section;
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
   - **Form dispatch groups and write them into EXECUTE.md** as a table: item,
     group id, step range, tier, code surface. A group is a run of consecutive
     steps sharing a tier and a surface. Grouping rounds a step's tier up,
     never down. A group never spans a commit boundary. Dispatch any
     contract-producing step alone, or paired only with the one step it is
     tightly coupled to. Group boundaries are a judgment call, not a
     mechanical partition — where the cut is genuinely ambiguous, prefer the
     boundary that gives the more reviewable diff.
   - **Write the item-specific tripwires into EXECUTE.md.** For each item,
     ask two questions: *if this change landed in only one of several
     required places, would anything fail?* and *what here could pass every
     check while doing nothing?* Every place where nothing would fail is a
     tripwire: name the step, what a plausible-but-wrong diff looks like, and
     the command or read that exposes it. Tripwires tell the orchestrator
     where to look hardest during review — don't leave finding them to luck.
   - **Write `EXECUTE.md`** from the template in
     `references/execute-template.md` (read it now:
     `cat "$CLAUDE_SKILL_DIR/references/execute-template.md"`) in the
     artifact directory, with absolute paths throughout, the effort-tier
     definitions copied in verbatim from `references/model-tiers.md`, and the
     dispatch groups table and tripwires filled in.
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
