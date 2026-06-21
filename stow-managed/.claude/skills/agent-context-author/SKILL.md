---
name: agent-context-author
description: >-
  Generate, audit, or restructure agent context files — CLAUDE.md, AGENTS.md,
  agent.md (pi), or any equivalent — for any repository or tool. Covers creation
  from scratch, improvement of existing files, and the split decision (when to break
  a root file into subdirectory CLAUDE.md files or .claude/rules/). Auto-invoke BEFORE
  creating or editing any CLAUDE.md, AGENTS.md, agent.md, or equivalent agent
  instruction file, or when the user asks to review or improve an existing one.
  Trigger phrases: "create a CLAUDE.md", "write a CLAUDE.md", "generate CLAUDE.md",
  "audit CLAUDE.md", "improve CLAUDE.md", "review CLAUDE.md", "split CLAUDE.md",
  "agent.md", "AGENTS.md", "context file for the repo", "add instructions for the
  agent", "update project instructions", "claude instructions", "write project rules",
  "agent context file", "agent instructions", "write context file".
disable-model-invocation: false
---

# agent-context-author

## Core Tenets

**Mental model:** Write for an engineer who knows the language but has never seen
this codebase. Starts fresh every session. No tribal knowledge.

**It is an operations manual, not a README clone.** Every line competes for the
agent's attention budget (~150–200 distinct instructions before adherence decays).
Cut anything the agent can infer from the code or standard conventions.

**Context shapes behaviour; hooks enforce it.** The decision table:

| Goal | Mechanism |
|---|---|
| Behavioural guidance | CLAUDE.md / agent.md |
| Hard enforcement (block tool/command) | `settings.json` permissions |
| Deterministic automation (format on save) | Hooks (PreToolUse/PostToolUse) |
| Multi-step workflow | Skill (`.claude/skills/`) |

**Two-strikes rule:** Only formalise a rule after the second occurrence of the same
mistake. First time → log in memory. Second time → promote to CLAUDE.md.

**Practical test for every rule:** "Would an agent get this wrong without being
told?" If no — or if it's inferable from `package.json`, docs, or standard
conventions — delete it.

**Freshness test:** If a line won't be true in six months, delete it now.

---

## Required Sections (in order)

```
1. STACK & TOOLING   — framework, language, DB, package manager, exact versions
2. HARD RULES        — absolute constraints with reasons; "No X because Y"
3. ARCHITECTURE      — key directories, module boundaries, data flow
4. COMMANDS          — build, test, lint, migrate — exact flags
5. CONVENTIONS       — naming, imports, error handling, commit style
6. COMMON TASKS      — step-by-step recipes for recurring work
7. PITFALLS          — accumulated gotchas (living list)
```

**Voice:** Imperative + reason. `ALWAYS run typecheck before committing — CI blocks
without it.` Not: "Please verify code quality." Reasons matter because the agent
reasons around rules it doesn't understand; it can't reason around rules it knows
are load-bearing.

**What to exclude:**
- Content the agent can read directly (`package.json`, README)
- Standard language conventions (the agent knows PEP 8, Prettier defaults)
- Speculative future features — teaches the agent to write speculative code
- Vague directives ("be careful", "write clean code")
- Every edge case — keep the top five, put the long tail in code comments

---

## Length Budget

| File | Target | Action if over |
|---|---|---|
| Root CLAUDE.md | 60–250 lines | Split into subdirectory CLAUDE.md files; use `.claude/rules/` for path-glob scoping (Claude Code only) |
| Subdirectory CLAUDE.md | 30–100 lines | Trim to essentials |
| `.claude/rules/*.md` | ≤ 200 per file | Split into more files |

**Compaction caveat:** Subdirectory CLAUDE.md files do NOT survive `/compact`. They
reload only when the agent next reads a file in that directory. Any rule that must
survive compaction belongs in the root file.

---

## Identify the Mode

| User intent | Workflow |
|---|---|
| No file exists | **A — Create** |
| File exists, user wants improvements | **B — Audit** |
| File is over ~200 lines | **C — Split** |
| Multi-tool project (Codex/Cursor/Copilot too) | **A — Create** AGENTS.md + thin CLAUDE.md stub (`@AGENTS.md`) |
| Pi project | **D — Pi agent.md** |

When intent is ambiguous, ask one question to resolve it before proceeding.

---

## Workflow A — Create

1. Survey the repo: read `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml`,
   the main README, and any CI config. Identify stack, language, package manager,
   test runner, notable constraints.
2. Draft the seven required sections. For each rule, write the reason inline.
3. Apply the length budget. If the draft exceeds 250 lines, move lower-priority
   sections to subdirectory CLAUDE.md files (preferred for cross-harness) or
   `.claude/rules/` (Claude Code only, path-glob scoping) before showing the user
   (see reference file).
4. Apply the freshness test and exclusion list above.
5. Show the draft. State what was included, what was excluded, and why.

---

## Workflow B — Audit

1. Read the existing file in full.
2. Apply the practical test to every rule: flag anything the agent would get right
   without being told, or that duplicates inferable content.
3. Check for anti-patterns: README clones, vague directives, speculative features,
   rules without reasons, contradicting rules, expired model IDs.
4. Count lines. If over 200, recommend splitting.
5. Report in two groups: **delete** (redundant/vague/expired) and **strengthen**
   (add reason, add concrete path, add example). Show as specific edits, not prose.

---

## Workflow C — Split

Split when the root file exceeds ~200 lines or distinct sections apply to
separate parts of the codebase.

**Default: subdirectory CLAUDE.md files** — cross-harness compatible (Claude
Code lazy-loads natively; pi loads via subdir-context extension). Place a
CLAUDE.md in the relevant subdirectory; it loads only when the agent first
touches a file there.

**Use `.claude/rules/` instead** only when:
- You need path-glob scoping (e.g. apply only to `**/*.test.ts`) — subdirectory
  CLAUDE.md cannot do this
- The project is Claude Code-only (no pi users)

Load the reference file for mechanics:

```bash
cat "$CLAUDE_SKILL_DIR/references/split-and-imports.md"
```

Show the proposed structure and get confirmation before moving anything.

---

## Workflow D — Pi agent.md

Pi's equivalent is `agent.md` (in `~/.pi/agent/` for global, `.pi/agent.md` for
project-local). Same principles apply but Pi has no `.rules/` subdirectory or
`@import` syntax. Keep under 100 lines. Focus on: stack, hard rules, top 3–5
pitfalls. Omit sections 5–6 (CONVENTIONS, COMMON TASKS) unless genuinely non-obvious.

---

## Quality Checklist

- [ ] Seven required sections present (or explicitly omitted with reason)
- [ ] Every rule has an inline reason ("No X because Y")
- [ ] Line count within budget for file type
- [ ] No README duplicates, standard conventions, or speculative features
- [ ] Hard rules are concrete and verifiable, not aspirational
- [ ] Practical test applied: delete anything the agent would get right unaided
- [ ] If split recommended: structure shown and confirmed before applying

## Load Reference Files When Relevant

- **references/split-and-imports.md** — load when: splitting into subdirectory
  CLAUDE.md files or `.claude/rules/`, adding path-scoped rules, setting up
  @imports, or handling multi-tool AGENTS.md
