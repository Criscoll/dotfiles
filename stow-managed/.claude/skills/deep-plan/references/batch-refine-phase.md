## Refine-all phase (batch mode)

The point of Refine-all is to convert **every non-`[quick]` roadmap item** into
validated, codebase-compatible requirements in one pass, with the whole roadmap
in view — so cross-item dependencies get caught now, not discovered mid-execution.
This replaces steps 1, 6, and 7 of `refine-phase.md`; step 5 of that file (the
REQUIREMENTS.md template) is reused as-is for each item below.

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
   about ambiguity the moment you hit it, exactly as `refine-phase.md` step 4
   does, via `AskUserQuestion` — but batch questions across items into as few
   calls as the tool allows (up to 4 questions per call) rather than asking
   one item at a time. `[quick]` items are skipped entirely here — they never
   get a REQUIREMENTS.md, in batch mode or otherwise.

3. **Write `items/NN-<item-slug>/REQUIREMENTS.md` for each non-`[quick]` item**,
   using the exact template from `refine-phase.md` step 5 (the `# Requirements:
   <item title>` structure with `> Roadmap item: <n> — <title>` header, Context,
   Goals, Validated Requirements, What We Know, Open Questions, Out of Scope).
   Create the `items/NN-<item-slug>/` directory as needed. No technical design
   in any of these files — that is Plan-all's job.

4. **Write `CONTRACTS.md`** at a **behavioural** level — what crosses an item
   boundary, not yet how it's implemented (Plan-all makes it concrete). One
   entry per contract:

```
# Contracts

## C1 — <short name>
- **Produced by:** item <n> — <title>
- **Consumed by:** item <m> — <title> (repeat if more than one)
- **Shape:** behavioural description of what's produced (e.g. "a CLI flag
  that accepts X and does Y"; concrete types/signatures come in Plan-all)
- **Verify:** (left blank — Plan-all fills this in with a concrete check the
  orchestrator can run)
```

5. **Run the annotation pass** across `ROADMAP.md`, every `REQUIREMENTS.md`,
   and `CONTRACTS.md` — the same `//`-prefixed convention as per-item mode.
   Re-read each file from disk, scan for `//` markers, address them, clear the
   markers. If nothing is open (because ambiguity was resolved via
   `AskUserQuestion` as you went), say so and offer approve-as-is as an equal
   path to annotating, exactly as `refine-phase.md` step 6 does.

6. **Gate → handoff to Plan-all.** When the user approves every REQUIREMENTS.md
   and CONTRACTS.md, do NOT roll into planning. Tell them plainly:

   > Refine-all approved. Run `/clear` to start a fresh session, then invoke `/deep-plan` again — it will detect that every item has a REQUIREMENTS.md and enter the Plan-all phase.

   If the artifacts live outside the repo, remind them to pass the path again
   so the next phase resolves the same artifact directory.
