## Refine phase

The point of Refine is to convert **every roadmap item** into validated,
codebase-compatible requirements in one pass, with the whole roadmap in view —
so cross-item dependencies get caught now, not discovered mid-execution.

1. **Re-read `ROADMAP.md` from disk** and restate the overall goal in one
   sentence. If the restatement feels wrong, stop and ask — do not refine
   around a guessed interpretation. Then read the code **across all items**,
   looking specifically for where they meet: shared files, shared data shapes,
   ordering constraints, anything one item's output feeds into another's input.
   Read-only recon sub-agents (e.g. `subagent` with the `scout` agent, or the
   equivalent in-harness recon tool) may gather raw context to keep your own
   context lean — but you, the planner, must read any code that touches a
   boundary between items yourself; don't take a sub-agent's summary as the
   final word on a contract's shape.

2. **For each non-`[quick]` item, in roadmap order:** restate it in one
   sentence, then validate it against the codebase **as it will exist after
   earlier items are built** — not just the codebase as it exists today. Ask
   about ambiguity the moment you hit it, via `AskUserQuestion` — but batch
   questions across items into as few calls as the tool allows (up to 4
   questions per call) rather than asking one item at a time. `[quick]` items
   are skipped entirely — they never get a `REQUIREMENTS.md`.

3. **Write `items/NN-<item-slug>/REQUIREMENTS.md` for each non-`[quick]`
   item.** Create the `items/NN-<item-slug>/` directory as needed. No
   technical design in any of these files — that is the Plan phase's job.
   Structure:

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

4. **Write `CONTRACTS.md`** at a **behavioural** level — what crosses an item
   boundary, not yet how it's implemented (the Plan phase makes it concrete).
   One entry per contract:

```
# Contracts

## C1 — <short name>
- **Produced by:** item <n> — <title>
- **Consumed by:** item <m> — <title> (repeat if more than one)
- **Shape:** behavioural description of what's produced (e.g. "a CLI flag
  that accepts X and does Y"; concrete types/signatures come in the Plan phase)
- **Verify:** (left blank — the Plan phase fills this in with a concrete check
  the orchestrator can run)
```

5. **Run the annotation pass** across `ROADMAP.md`, every `REQUIREMENTS.md`,
   and `CONTRACTS.md` — the `//`-prefixed convention: re-read each file from
   disk, scan for `//` markers, address them, clear the markers. If nothing is
   open (because ambiguity was resolved via `AskUserQuestion` as you went),
   say so and offer approve-as-is as an equal path to annotating rather than
   implying an annotation round is required.

6. **Gate → handoff to Plan.** When the user approves every REQUIREMENTS.md
   and CONTRACTS.md, do NOT roll into planning. Tell them plainly:

   > Refine approved. Run `/clear` to start a fresh session, then invoke `/deep-plan` again — it will detect that every item has a REQUIREMENTS.md and enter the Plan phase.

   If the artifacts live outside the repo, remind them to pass the path again
   so the next phase resolves the same artifact directory.

---

### Re-planning a single item (failure recovery)

The steps above describe the first, whole-roadmap Refine pass. When the
orchestrator (see `plan-phase.md`'s EXECUTE.md template) halts on a failed
item, recovery re-runs Refine **scoped to that one item** — see
`references/replan-phase.md` for the mechanics. It reuses this file's
REQUIREMENTS.md template and the same "ask, don't guess" discipline, just
narrowed to one item plus its downstream dependents.
