# Single Source of Truth for Shared Planning Principles

## The Problem

`inline-plan.ts`'s `planDirective()` and `deep-plan`'s `plan-phase.md` encode the **same
planning philosophy at two altitudes** — inline-plan is a one-shot lightweight directive,
deep-plan is the durable multi-phase version. The principles are meant to stay aligned, but
the text is physically duplicated across two files in two trees (`.pi/` and `.claude/`), so
editing one and forgetting the other causes silent drift.

Clearest evidence: the two verification anti-patterns — **VERIFY SCOPE** and **EXECUTOR
SELF-INTERFERENCE** — are duplicated almost word-for-word (`inline-plan.ts:127–136` vs
`plan-phase.md:56–69`). Beyond those, the same cross-cutting principles appear in prose in
both files:

- **Self-contained fresh-agent handoff** — `inline-plan.ts:81–87`, deep-plan rule `SKILL.md:84`
- **Carry exploration forward** (inline exact signature + `file:line`) — `inline-plan.ts:85–87`
  + Code Snippets; deep-plan Reuse + Distill, `plan-phase.md:7–9`
- **Approach states the why and what was rejected** — `inline-plan.ts:93–95,101–103`; deep-plan
  rule `SKILL.md:81`

### Overlap map (section by section)

| `inline-plan` directive | `deep-plan` PLAN.md | Relationship |
|---|---|---|
| `## Goal` | `## Goal` | Near-identical |
| `## Approach (and alternatives considered)` | `## Key Decisions` + `## Technical Context` | Same principle, deep-plan adds OPEN→collapse gate |
| `## Constraints` | `## Technical Context` | Overlapping |
| `## Steps` | `## Proposed Steps` + `## Todo` | Overlapping; deep-plan splits altitude |
| `## Code Snippets` | `## Reuse` | Same principle; deep-plan far more elaborate |
| `## Verification` | `## Testing & Verification` | **Near-verbatim duplication** (the two anti-patterns) |
| `## Post-implementation` | — | inline-plan only |
| — | `## Edge Cases`, `## Boundaries`, `## Out of Scope`, Roadmap header | deep-plan only |

High overlap in *principle*, intentionally different in section taxonomy and depth. The
templates can't merge wholesale (different altitude; the pi directive is a compiled string
literal, deep-plan is `cat`-able markdown), but the shared *principle text* could have one
source.

## The Goal

Extract all shared principle text into one canonical file that both consume, so a single
edit propagates to both. inline-plan keeps its lighter structural template; deep-plan keeps
its deeper machinery (Key Decisions, Boundaries, Reuse). Only the genuinely shared principle
statements move.

## Proposed Solution

Create one canonical reference file owned by `deep-plan` (the deeper/canonical planner) and
have both consume it:

- **deep-plan** consumes via its existing "Load Reference Files When Relevant" mechanism
  (`SKILL.md:61–67`) — the planning agent `cat`s the file and applies it.
- **inline-plan.ts** consumes via `readFileSync` of the resolved absolute path, with a short
  degraded fallback if the file is absent (resilient-source pattern, matching `hook-logger`).

### Why this location

The two harnesses are separate trees with no shared parent except `~`, so any shared file
lives in one tree and is read cross-tree by the other — there is no perfectly neutral home.
deep-plan already has a `references/` directory with an established `cat`-to-load convention
and is the canonical/deeper artifact, so it is the natural owner. Cross-tree reads are
already used in this repo (`web-search.ts` → `~/bin/agent_scripts/`), so this is consistent
with conventions.

### Why a short fallback, not a full inline copy

A full inline fallback in `inline-plan.ts` would reintroduce the exact duplication we're
removing. Instead the fallback is a 2–3 line condensed reminder, used only when the canonical
file is missing (rare — both files are stowed from the same repo). Accepted tradeoff: on a
machine where deep-plan is excluded via `.stow-local-ignore` but inline-plan is present,
inline-plan's directive degrades to the leaner reminder rather than the full principles.

### Verified mechanics

- pi extensions have **no build step** (no `tsconfig.json`/`package.json` under
  `stow-managed/.pi`) — `readFileSync` at runtime is the only way to pull external text into
  the directive string.
- Runtime reads from `homedir()`-relative paths are already an established pattern
  (`prompt-history.ts:54`, `subagent.ts:87`, `web-search.ts:13`).
- The shared content is **planning-time guidance**, not content the downstream executor needs
  verbatim — so it doesn't need to be physically copied into `PLAN.md`; it guides how the
  verification section is written.

## Implementation Steps

1. **Create** `stow-managed/.claude/skills/deep-plan/references/shared-planning-principles.md` —
   four labeled sections (Self-contained handoff; Carry exploration forward; Approach states
   the why and what was rejected; Verification discipline incl. both anti-patterns verbatim),
   phrased harness-neutrally, with a header naming both consumers so the dependency is
   discoverable from the file itself.

2. **Wire inline-plan.ts** — add `readFileSync` to the `node:fs` import (line 32); add a
   module-level loader resolving
   `join(homedir(), ".claude", "skills", "deep-plan", "references", "shared-planning-principles.md")`
   in try/catch with a short fallback constant; in `planDirective()` (68–144) interpolate the
   loaded block and remove the now-duplicated inline prose (carry-forward sentence 85–87, the
   "what was rejected" wording, the Verification anti-patterns block 127–136). Keep
   inline-plan-specific scaffolding (write_plan instruction, markdown template, Code Snippets,
   Post-implementation).

3. **Update deep-plan** — `plan-phase.md`: remove the embedded anti-patterns prose (56–69),
   replace with a one-line pointer to the shared file; drop any sentence merely re-stating a
   now-shared principle (keep Reuse machinery). `SKILL.md`: add the file to the load list
   (61–67), loaded during Plan (and Refine where relevant); note in Rules that shared
   principles live there.

4. **Document the coupling** — one line in project `CLAUDE.md` noting that planning principles
   shared between inline-plan and deep-plan are single-sourced in
   `deep-plan/references/shared-planning-principles.md`.

## Verification

- `rg -l "EXECUTOR SELF-INTERFERENCE" stow-managed/` returns **only**
  `shared-planning-principles.md`.
- `npx eslint stow-managed/.pi/agent/extensions/inline-plan.ts` exits 0 (the enforced TS gate;
  there is no `tsc` build for extensions).
- A node snippet replicating the loader against the real path returns non-empty text
  containing "EXECUTOR SELF-INTERFERENCE"; against a wrong path, returns the fallback without
  throwing (graceful degradation).
- `rg "shared-planning-principles" stow-managed/.claude/skills/deep-plan/SKILL.md` shows it in
  the load list.

## Considered and Rejected

- **Cross-reference comment markers only** — flags drift but doesn't prevent it mechanically.
- **A brand-new neutral stow target** (e.g. `~/shared/`) — adds a stow target + guard-dir
  overhead for a single file; not worth it.
- **One-time alignment with no structural change** — accepts future re-drift.
