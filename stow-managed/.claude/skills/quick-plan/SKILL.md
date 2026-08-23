---
name: quick-plan
description: >-
  Turn a single, well-scoped task into an executable plan — explore the code, ask clarifying
  questions, then write ONE durable plan file to .plans/quick-plans/ and hand the user a copy-paste
  prompt for a fresh (post-/clear) agent to execute it; the executor moves the plan to /tmp when done
  and verified. Single-pass and file-backed: heavier than /plan (inline, no file, no handoff) and
  lighter than /deep-plan (multi-phase roadmap loop for large efforts). Use when the user says "quick
  plan X", "quick-plan", "scope this out and hand it off", or "plan this small task for a fresh agent".
  For a throwaway inline plan use /plan; for a large multi-step effort use /deep-plan.
disable-model-invocation: false
---

You turn a well-scoped task into an executable plan file plus a handoff prompt. You do **not** implement — the whole point is that a *fresh* context executes the plan, not you. You stop at the handoff gate.

## Scope check first

- If the task needs multi-step sequencing or several vertical slices → stop and recommend `/deep-plan` instead.
- If the user only wants to think a problem through (no file, no handoff) → recommend `/plan` instead.
- Otherwise, proceed.

## Steps

1. **Understand + restate.** Restate the task in one sentence before doing anything else. If the restatement feels wrong, ask before proceeding.

2. **Explore inline.** Read the relevant files, grep for related symbols, check for existing utilities to reuse. Do this directly yourself — **do not spawn subagents**. This is the fast, cheap path; a small well-scoped task doesn't need fan-out.

3. **Clarify exhaustively — this is the critical phase.** A plan handed to a fresh agent can't ask questions mid-execution, so every unresolved ambiguity here becomes a wrong guess there. Treat the user's initial request as under-specified by default — it's your job to investigate and probe, not to fill gaps with assumptions.
   - **Ground questions in the exploration.** The best questions come from what step 2 surfaced — real decision forks the code presents (which of two existing patterns to follow, where a new file belongs, how an edge case should behave), not generic boilerplate.
   - **Ask well-defined, decision-shaped questions.** Each should name a concrete choice with real options, not a vague "any preferences?". Use `AskUserQuestion` (batched, up to 4 per call, each with 2–4 labeled options) so the user answers a structured form.
   - **The tool's 4-per-call limit is not a cap on how many you may ask.** Keep issuing `AskUserQuestion` calls — round after round — until the task is genuinely well-scoped. Answers often reveal new unknowns; probe those too. Better to ask one round too many than hand off a plan built on a guess.
   - **Loop back to explore** if an answer opens a new area you haven't read. Investigation and probing alternate until the scope is solid.
   - Stop only when the remaining unknowns are trivial or genuinely yours to settle with a sensible default (state that default in the plan). Don't manufacture questions once the scope is actually clear.

4. **Write the plan file** to `.plans/quick-plans/<slug>.md` under the current directory (`mkdir -p` first). Derive `<slug>` from the task (lowercase, hyphenated) — name it descriptively, not literally `plan.md`, so multiple quick-plans can coexist. `.plans/` is gitignored at any depth, so plans never get committed. State the written path in one line. Use the template below.

5. **Review gate.** Point the user at the file; if they want changes, edit the file directly and re-confirm. Do **not** emit the handoff prompt until they approve.

6. **Emit the handoff prompt** as a fenced code block (never a blockquote — a `>` gutter bar gets dragged into the copy; a code block pastes clean). Fill placeholders with real values and **absolute paths** (the executor's cwd may differ). Tell the user to `/clear` and run it in a fresh session.

## Plan file template

```
# Quick Plan: <title>

## Context
Why this change — the problem/need, what prompted it, intended outcome. 1–3 sentences.

## Goal
One sentence: what executing this plan accomplishes.

## Decisions
Choices settled during clarification, so the executor doesn't re-litigate them. (Omit if none.)

## Relevant files & reuse
Concrete paths and existing functions/utilities to reuse — so the executor doesn't re-search.
- `path/to/file.ext:line` — what's there / why it matters

## Steps
Ordered, concrete, directly executable.
1. …
2. …

## Verification
Exact command(s) or check to confirm it works end-to-end. Name the test/lint/build gate.

## Out of scope
What this plan deliberately does NOT touch.
```

## Handoff prompt template

Fill `<the gate from the plan>` with the actual verification command(s) from the plan file.

```
Read <abs-path-to-plan> in full, then execute it.

Principles:
- Follow the Steps in order. The thinking is done — don't re-plan or re-explore what the plan settled.
- Reuse what "Relevant files & reuse" names; don't re-search for it.
- Stay in scope. No refactors, cleanups, or "while I'm here" changes beyond the Steps — "Out of scope" is binding.
- If reality diverges from the plan (a file/function isn't as described, a step can't work as written), STOP and surface it rather than improvising a workaround.
- When all Steps are done, run the Verification gate (<the gate from the plan>) and fix failures before calling it complete.
- Once done and verified, archive the plan: `mv <abs-path-to-plan> /tmp/`

Do not start until you've read the whole plan.
```

## Rules

- **Never implement.** `quick-plan` stops at the handoff gate; a fresh context does the work — that's the whole design.
- **Explore inline, don't spawn subagents** — this is the quick path; fan-out is overkill for a well-scoped task.
- **One descriptively-named file in `.plans/quick-plans/`** under the current directory; gitignored, never committed.
- **Escape hatches:** multi-step/multi-slice → `/deep-plan`; think-only, no file → `/plan`.
- **Handoff prompt is a fenced code block, never a blockquote**, with absolute paths and placeholders filled.
- **Keep the plan honest and lean** — a shorter accurate plan beats a longer speculative one; don't pad Steps.
- **Clarification is the critical phase — probe exhaustively.** Assume the request is under-specified; keep asking well-defined `AskUserQuestion` rounds (the 4-per-call limit is not a total cap) until scope is solid. A guessed answer here is a wrong guess in the fresh executor's session, which can't ask.
