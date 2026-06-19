## Refine phase

The point of Refine is to convert the **current roadmap item** into validated, codebase-compatible requirements that a fresh agent can pick up without your context.

1. **Re-read `ROADMAP.md` from disk** and identify the current item (first unchecked). State which item you're refining. Everything below is scoped to **that one item** — not the whole roadmap.

2. **Restate** the item in one sentence. If the restatement feels wrong or the item is ambiguous, stop and ask — do not refine around a guessed interpretation.

3. **Validate against the codebase.** Read the relevant code in depth — not just the file named, but how it connects to the surrounding system. Grep for related symbols, check `git log` for prior work, read adjacent modules and their callers. You're answering: *does this item make sense, and is it compatible with what already exists* (including whatever earlier roadmap items already built)?

4. **Ask when unclear.** If the item is ambiguous, under-specified, or incompatible with the code as written, use AskUserQuestion to resolve it. Asking is this phase's entire job — do not paper over gaps by guessing.

5. **Write `REQUIREMENTS.md`** (overwrite any stale one from a previous item) — self-contained enough that a fresh agent (or you, post-`/clear`) can pick it up cold. Tell the user the path once written. Structure:

```
# Requirements: <item title>

> Roadmap item: <n> — <title>   (from ROADMAP.md; lets a fresh session confirm scope)

## Context
Why this item is being done now — the problem or need, what it builds on from
earlier roadmap items, the intended outcome.

## Goals
One or two sentences. What this item achieves and why. The anchor everything
else serves.

## Validated Requirements
The verified, codebase-compatible ask for THIS item. What must be true when it
is done. Each requirement concrete enough to plan against and to test against later.

## What We Know
Confirmed facts from the codebase, docs, or context that establish the item is
feasible — relevant file paths, how the affected components connect, constraints
discovered, prior work from git log or earlier roadmap items.

## Open Questions
What must still be answered before planning can start. Name what is unknown
and why it blocks progress. Do not resolve these by guessing.

## Out of Scope
What this item explicitly does NOT cover (including anything deferred to a later
roadmap item).
```

   **No technical design here** — no chosen approach, no file-by-file steps, no edge-case engineering. That is the Plan phase's job. Refine establishes *what and why* for this item, validated against reality; Plan decides *how*.

6. **Annotation cycle on `REQUIREMENTS.md`.** Hand control back with this invitation:

   > REQUIREMENTS.md is written at `<path>`. Open it and add inline notes anywhere you want changes — prefix each note with `//` (like a code comment) so I can find them: corrections, removed requirements, missed constraints, clarifications. Then tell me "address my notes" and I'll update it. **I won't plan or implement anything until you explicitly approve.**

   When the user says they've annotated: re-read the file from disk, **scan for `//`-prefixed notes**, address every one in place, clear the `//` markers once resolved, report what changed, and return to the gate. Repeat as many rounds as the user wants.

7. **Gate → handoff to Plan.** When the user approves, do NOT roll into planning. Tell them plainly:

   > Requirements approved. Run `/clear` to start a fresh session, then invoke `/deep-plan` again — it will detect REQUIREMENTS.md and enter the Plan phase for this item.

   If the artifacts live outside the repo (user specified a custom path), remind them to pass the path again on the next invocation. The fresh session is deliberate: the Plan phase should start from the clean artifact, not your accumulated Refine context.
