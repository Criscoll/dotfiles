## Plan phase

The point of Plan is to turn the current item's approved requirements into a technical design durable enough to implement from.

1. **Re-read `REQUIREMENTS.md` from disk.** It is this phase's input and the session is fresh — load it, don't reconstruct it from memory. Confirm its `Roadmap item` header matches the current unchecked item in `ROADMAP.md`. If it has unresolved Open Questions, surface them and resolve with the user before planning on top of them.

2. **Research for decisions.** Do any further targeted reading needed to make sound technical choices — the requirements told you *what*; you may need to look closer to decide *how*. As you research, **extract concrete code-level context** — don't just understand the approach conceptually, capture the exact import paths, function signatures, class/interface names, API contracts, and file paths to proven implementations. You WILL write these into the plan's Reuse section in the next step.

3. **Distill references.** Before writing the plan, consolidate what you found in step 2 into a Reuse section. The goal: an implementer reading the plan should never need to open a reference file or doc — every concrete import path, function signature, interface name, API contract, and gotcha is already written down. If you found yourself reading an example file (handoff.ts, qna.ts, etc.) or a doc page (extensions.md, tui.md, etc.), you must have captured what you learned from it here.

4. **Write `PLAN.md`** (overwrite any stale one from a previous item). Tell the user the path once written. Structure (the requirements material lives in REQUIREMENTS.md and is not duplicated here):

```
# Plan: <item title>

> Roadmap item: <n> — <title>   (must match REQUIREMENTS.md and ROADMAP.md)

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
user to resolve them — the plan does NOT hand off to Act with open decisions.
On approval this section COLLAPSES (see Gate step): the Option A/B menu is dropped,
but each decision keeps a short record — what was chosen, briefly why, and what was
considered-and-rejected with the reason. That reasoning trail is context the
implementer needs, not noise.

## Proposed Steps
High-level sequence, not implementation detail. Each step independently
reviewable. Mark steps blocked on an open question with [BLOCKED: <question>].

## Testing & Verification
How the implementer will know each step works. Name the test framework and
where tests live, the specific cases worth covering (not just "add tests"),
and the verification gate the whole item must pass before it's done
(e.g. typecheck && lint && test && build). If the change isn't testable in
the usual way, say how it will be verified instead.

Two verification anti-patterns to call out in the plan when relevant:

- **Verify scope:** When the plan wraps or instruments existing behavior (logging,
  caching, metrics), scope verification to the new behavior only. Do not re-verify
  the underlying logic — it wasn't changed and wasn't a regression risk. Write this
  explicitly in the plan's Testing & Verification section so the implementer doesn't
  drift into re-testing pre-existing behavior.

- **Executor self-interference:** If the Act session runs inside an environment with
  its own input guards (hooks, extensions), verification commands that embed a guarded
  pattern — even as a quoted string or JSON fixture — may be silently intercepted.
  The guard's block message appears as output, but no subprocess ran. When this risk
  exists (plan configures the system the implementer runs in), note it and prefer
  reading side-effects (log files, state files) over synthesizing matching inputs.

## Todo
A granular, checkbox task list derived from Proposed Steps — the tracker the
implementer will work through for THIS item. Break into sub-phases if the item
has natural stages.
- [ ] task
- [ ] task

## Boundaries
Behavioral guardrails for the implementer, in three tiers:
- **✅ Always** — invariants the implementation must uphold
- **⚠️ Ask first** — changes that require checking with the user before proceeding
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

5. **Annotation cycle on `PLAN.md`.** Hand control back:

   > PLAN.md is written at `<path>`. Open it and add inline notes anywhere you want changes — prefix each note with `//` (like a code comment) so I can find them: corrections, removed sections, different approaches, missed context. Then tell me "address my notes" and I'll update it. **I won't implement anything until you explicitly approve.**

   > If the plan has open decisions (marked `[OPEN — needs your decision]` in Key Decisions), I've listed them above — tell me which option you want for each, or annotate your choice inline. I can't hand this off to implementation while any decision is still open.

   When the user says they've annotated: re-read from disk, **scan for `//`-prefixed notes**, address every one in place, clear the `//` markers once resolved, report what changed, and return to the gate. Repeat as many rounds as the user wants. The guard holds every round: **do not write production code until the user explicitly approves.**

6. **Gate → hand off Act.** When the user approves, do NOT roll into coding. **First, confirm every decision is resolved.** If any decision in `## Key Decisions` is still `[OPEN]`, do not collapse or hand off — surface the open decisions and ask the user to resolve them, exactly as with an unresolved Open Question. Once all are decided, **collapse the menu, keep the reasoning:** edit `PLAN.md` so each decision drops its Option A/B framing and becomes a settled record — *what* was chosen, briefly *why*, and *what was considered and rejected, with the reason*. The implementer reads one chosen path but keeps the "why not the alternative" behind it. Tell the user you've collapsed it.

   Then state plainly that implementation is a separate session and the approved `PLAN.md` (with its Todo list) is the source of truth for this item. Hand them a ready-to-paste **implementation prompt**. Emit it as a **fenced code block** (triple backticks), never a `>` blockquote — a blockquote renders with a left gutter bar that gets dragged into the copy, whereas a code block copies clean and has a one-click copy button. Tailor it to the plan, following this shape (placeholders filled in with real values):

   ```
   Implement <path>/PLAN.md (roadmap item <n> — <title>). Work through the Todo list in order, marking each task complete in PLAN.md as you go. Read the Reuse section for import paths, function signatures, and reference files — do not search for these yourself, they're already distilled. Uphold the Boundaries section (Always/Ask/Never). Do not stop until all tasks are done. Run the Testing & Verification gate (<the gate from the plan>) and fix failures before considering the item complete. When the gate passes, tick this item's box (- [ ] → - [x]) in <path>/ROADMAP.md. No unrelated changes or "while I'm here" fixes.
   ```

   Fill `<the gate from the plan>` with the actual command(s) from the Testing & Verification section. Always use **absolute paths** to `PLAN.md` and `ROADMAP.md` in the implementation prompt — the Act session starts fresh and its working directory may differ. Tell them to `/clear` and run it in a fresh session — optionally on a cheaper model, since the thinking is already captured in the plan. If the plan still has unresolved Open Questions, note that the prompt should not be run until they're answered.

   **Then point at the loop.** Tell the user that once the item is implemented and its box is ticked, they should `/clear` and re-invoke `/deep-plan` to enter Refine for the next roadmap item — and that deep-plan will report when every item is checked and the roadmap is complete.
