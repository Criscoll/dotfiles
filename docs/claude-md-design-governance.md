# CLAUDE.md / AGENTS.md Design Governance

**Status:** Settled convention (June 2026)  
**Scope:** All projects using Claude Code, Codex, Cursor, Copilot, or any AGENTS.md-compatible coding agent.  
**Audience:** Agents writing or editing these files, and humans reviewing them.

This document codifies how CLAUDE.md and AGENTS.md files should be written, structured, split, maintained, and measured. It synthesises official Anthropic documentation, the AGENTS.md open standard (Linux Foundation / Agentic AI Foundation), 2026 academic research, and community consensus across 60,000+ repos.

---

## 1. Philosophy & Context Model

### Context Engineering, Not Prompt Engineering

CLAUDE.md and AGENTS.md are **runtime variables in a system**, not static prompts (Karpathy, 2025). They are injected into the agent's context window at session start. Every line competes for the agent's **attention budget** — the finite span of tokens where the model reliably adheres to instructions (Anthropic: 150–200 distinct instructions before compliance decays).

**Mental model:** Write these as an onboarding doc for an engineer who knows your language but has never seen your codebase. Starts fresh every session. Has no tribal knowledge.

### The Two-Strikes Rule

Only write a rule on the **second occurrence** of the same error or correction. First occurrence might be a fluke. If you commit a rule on every mistake, signal-to-noise collapses.

- **First time:** Log it in MEMORY.md (auto memory) as "observed X".
- **Second time:** Promote it to CLAUDE.md as a formal rule.

### What CLAUDE.md Is (and Isn't)

| Is | Is Not |
|---|---|
| Operations manual for an agent | Re-skin of README.md |
| Fossil layer of project decisions | Roadmap or changelog |
| Living document, pruned regularly | Written-once static file |
| Context (shapes behaviour) | Enforcement (that's hooks/settings) |

Academic research supports this: Princeton (arXiv:2601.20404) found human-written AGENTS.md reduced median runtime by **28.6%** and token usage by **16.6%**. ETH Zurich (arXiv:2602.11988) found that *auto-generated* files reduced success rates while increasing cost by 23%. **Quality and specificity matter more than presence.**

---

## 2. The Five-Layer Hierarchy

Claude Code loads CLAUDE.md files from five scopes in a defined order. Lower-numbered scopes load first (broader, lower priority); higher numbers override.

| Layer | Location | Purpose | Line Target | Survives /compact? |
|---|---|---|---|---|
| 1. Managed policy | `/etc/claude-code/CLAUDE.md` | Org-wide, cannot be excluded | Under 200 | Yes |
| 2. User global | `~/.claude/CLAUDE.md` | Personal cross-project defaults | Under 10 | Yes |
| 3. Project root | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team instructions | 60–250 | **Yes** (re-read from disk) |
| 4. Topic rules | `.claude/rules/*.md` | Modular, optionally path-scoped | Per-file ≤ 200 | Yes (loaded at launch) |
| 5. Subdirectory | `./packages/*/CLAUDE.md` | Scoped to a sub-tree | 30–100 | **No** (reloads on file-read) |

**Critical distinction for layer 5:** Subdirectory CLAUDE.md files are **not re-injected after `/compact`**. They reload only when Claude next reads a file in that directory. Instructions that must survive compaction belong in the root CLAUDE.md.

### AGENTS.md Hierarchy

AGENTS.md (the cross-tool open standard) uses a simpler model: **nearest file wins**. Place one per package in a monorepo. The agent reads the closest AGENTS.md to the file being edited. OpenAI's Codex repo uses 88 AGENTS.md files across its directory tree.

---

## 3. Writing Rules: Content & Structure

### Required Sections (in order)

```
1. STACK & TOOLING      — Framework, language, DB, package manager, exact versions
2. HARD RULES           — Absolute constraints with reasons; "No X because Y"
3. ARCHITECTURE         — Key directories, module boundaries, data flow
4. COMMANDS             — Build, test, lint, migrate — exact flags
5. CONVENTIONS          — Naming, imports, error handling, commit style
6. COMMON TASKS         — Step-by-step recipes for recurring work
7. PITFALLS             — Accumulated gotchas (living list)
```

### Voice & Style

- **Imperative, strong modals:** `ALWAYS run pnpm typecheck before committing.`  
  Not: "Please verify code quality before submitting changes."
- **Include the reason:** `No pink on cream — contrast ratio fails WCAG AA.`  
  Claude will reason around a rule it doesn't understand. It won't reason around a rule it knows is load-bearing.
- **Concrete paths and commands:** `api handlers live in src/api/handlers/`  
  Not: "Keep API handlers organised."
- **Examples over descriptions:** Show a correct and incorrect snippet.

### Length Budget

| Size | Guidance |
|---|---|
| ≤ 60 lines | Ideal for focused subdirectory files |
| 60–250 lines | Target range for root CLAUDE.md |
| 250–500 lines | Must be partitioned into `.claude/rules/` |
| > 500 lines | Dangerous; split aggressively or link out |

These are consistent across Anthropic docs, the 2,500-repo GitHub analysis, and the Chinese community's "800-character" experiments (which map to ~180 lines).

### What to Exclude

- **README content the agent can read directly.** The agent reads `package.json`, so don't duplicate `scripts`.
- **Standard language conventions.** Agents know PEP 8, Prettier defaults, etc.
- **Roadmaps and "future work".** These age out in a week. Use TODO.md or an issue tracker.
- **Team history, tribal knowledge, inside jokes.** The agent will misinterpret.
- **Speculative features.** "We might add GraphQL later" teaches the agent to write speculative code.
- **Style guides longer than a paragraph.** Move to DESIGN.md, link from CLAUDE.md.
- **Every edge case.** Keep the top five. The long tail belongs in code comments.

**The freshness test:** If a line won't be true in six months, delete it now.

---

## 4. Splitting & Organisation

### When to Split

When your root CLAUDE.md exceeds **200 lines**, split by topic into `.claude/rules/`. Additional signals:
- Multiple team members maintain different sections
- Instructions only apply to specific file types or directories
- You find yourself scrolling past irrelevant rules mid-session

### `.claude/rules/` Directory Structure

```
.claude/rules/
├── code-style.md          # Always loaded
├── testing.md             # Always loaded
├── api-design.md          # Path-scoped to src/api/**
├── database.md            # Path-scoped to migrations, models
├── security.md            # Always loaded (hard rules)
├── frontend/              # Subdirectories supported
│   ├── react-conventions.md
│   └── css-patterns.md
└── backend/
    ├── ef-core.md
    └── error-handling.md
```

Claude Code discovers `.md` files **recursively** in `.claude/rules/`.

### Path-Scoped Rules

Use YAML frontmatter to load a rule only when matching files are touched:

```yaml
---
paths:
  "src/api/**/*.ts"
  "src/api/**/*.tsx"
---

# API Development Rules

- All endpoints must include input validation
- Use standard error response format: { error, message, code }
- Include OpenAPI documentation comments
```

Rules without a `paths` field load at launch alongside CLAUDE.md. Path-scoped rules trigger when Claude *reads* files matching the pattern — zero token cost until then.

**Glob patterns supported:**
| Pattern | Matches |
|---|---|
| `**/*.ts` | All TypeScript files |
| `src/**/*` | All files under src/ |
| `src/**/*.{ts,tsx}` | Brace expansion for multiple extensions |

### Subdirectory CLAUDE.md Files

In a monorepo, place a short CLAUDE.md in each package:

```
/packages/web/CLAUDE.md      → "Next.js 16, pnpm, Vitest"
/packages/api/CLAUDE.md      → "Fastify 5, bun, node:test"
/cli/CLAUDE.md               → "CLI tool, oclif framework"
```

Root CLAUDE.md covers workspace-level rules. Subdirectory files add package-specific context and merge in. Remember the compaction caveat: subdirectory files reload on file-read, not after `/compact`.

### AGENTS.md Monorepo Pattern

For cross-tool projects, place `AGENTS.md` in each package directory. The agent reads the **nearest** file to the file being edited. OpenAI's Codex uses 88 AGENTS.md files across their repo — that's the proof point for this approach at scale.

---

## 5. @imports & Cross-Referencing

### CLAUDE.md @import Syntax

CLAUDE.md can import external files using `@path/to/file` at any point. Imported files are expanded inline and loaded into context at launch.

```markdown
# In CLAUDE.md

@AGENTS.md

## Claude-Specific Rules
- Use plan mode for changes under src/billing/
```

**Rules:**
- Relative paths resolve relative to the file containing the `@import`, not the working directory
- Absolute paths and `~`-prefixed paths are supported
- Maximum recursion depth: **4 hops** (official Anthropic docs say 4; some sources say 5)
- Code-fenced `@path` references are treated as literal text (not imports)
- First encounter of external imports shows an approval dialog

### AGENTS.md as Source of Truth

For projects using multiple agents (Claude Code + Codex + Cursor + Copilot), put **shared context** in `AGENTS.md` and make `CLAUDE.md` a thin stub:

```
@AGENTS.md
```

Or symlink it: `ln -s AGENTS.md CLAUDE.md`

This way switching tools requires no reconfirmation. Claude-specific optimisations live at the bottom of CLAUDE.md, after the import.

### Shared Rules via Symlinks

The `.claude/rules/` directory supports symlinks, enabling cross-project rule sharing:

```bash
ln -s ~/shared-claude-rules .claude/rules/shared
ln -s ~/company-standards/security.md .claude/rules/security.md
```

Circular symlinks are detected and handled gracefully.

### Personal Overrides

`CLAUDE.local.md` is deprecated (Anthropic issue #2950). Use `@import` instead:

```markdown
# In CLAUDE.md (project root — committed)
@~/.claude/my-preferences.md
```

Add `my-preferences.md` to your global `~/.claude/` and never commit it. Use this for sandbox URLs, preferred test data, and other machine-specific context.

---

## 6. Maintenance Lifecycle

### Pruning Cadence

- **Monthly:** Re-read your CLAUDE.md. Delete or archive every rule that no longer applies.
- **Per-session:** When you repeat a correction, add it immediately.
- **Per-mistake:** Convert one-time pain into long-lived rules (in the Pitfalls section).

### Rule Promotion Pipeline

Rules flow through three tiers as they prove their value:

```
MEMORY.md (auto memory)
  → first occurrence logged but not formalised

CLAUDE.md / .claude/rules/
  → second occurrence → promoted to formal rule

.claude/skills/
  → when a rule matures into a multi-step workflow
  → unloaded from startup context, loaded on demand
```

This mirrors the `claude-evolve` pattern (active → dormant → dead) and prevents context bloat.

### Versioning Conventions

Maintain a changelog block at the top of CLAUDE.md:

```markdown
<!-- Changelog: keep humans aware of rule changes -->
<!-- v2026-06-21: Added two-strikes rule -->
<!-- v2026-06-15: Moved API conventions to .claude/rules/api-design.md -->
```

Block-level HTML comments are stripped by Claude Code before injection — they're visible to human readers in the file but cost zero context tokens.

### The Evolution Contract

Include a self-evolution line in your CLAUDE.md so both agent and human know to append:

> This is a living document. When you make a mistake, add it to the Pitfalls section.

---

## 7. Anti-Patterns

### Critical Anti-Patterns

| Anti-Pattern | Why It Hurts | Fix |
|---|---|---|
| **README clone** | Duplicates what the agent can read directly. Redundancy increases cost (ETH Zurich: +23%) | Cut every line the agent can infer from code |
| **Vague directives** | "Be careful", "Write clean code" — agent already tries | Replace with concrete, verifiable rules |
| **Expired model IDs** | `claude-3-opus` no longer exists | Use model aliases like `claude-sonnet-4-6` or omit |
| **Speculative features** | Agent writes code for a future that may not arrive | Delete. Keep in issue tracker. |
| **Hard-coded secrets** | API keys, tokens, credentials in committed files | Never. Use env vars. |
| **Over-200-line bloat** | Adherence decays beyond 200 distinct instructions | Split into `.claude/rules/`; use path-scoping |
| **Step-by-step procedures** | Agents are better at goal-directed execution than follow-the-dots | Write success criteria, not instruction sequences |
| **Scattered contradicting rules** | Two rules that conflict for the same behaviour → agent picks arbitrarily | Review all loaded files for conflicts |

### The Most Common Pattern Question

> "Should I put this in CLAUDE.md or in a hook?"

| If you want... | Use |
|---|---|
| Behavioural guidance | CLAUDE.md |
| Hard enforcement (block a tool/command/path) | `settings.json` permissions → deny |
| Deterministic automation (format on save, notify on failure) | Hooks (PreToolUse, PostToolUse) |
| Step-by-step multi-file workflow | Skill (`.claude/skills/`) |

---

## 8. Measuring Effectiveness

### What to Track

- **Token cost per task:** With vs without CLAUDE.md. Princeton study baseline: 16.6% reduction.
- **Exploratory tool calls:** Grep/glob/read calls before first edit. Should decrease with good context.
- **Rule compliance:** Does the agent follow your hard rules? Use PostToolUse hooks with analytics to measure.
- **Compact frequency:** Frequent compaction suggests context pressure — your instructions may be too long.
- **Session outcome:** Is the agent making the same mistakes it made last week? If yes, your CLAUDE.md isn't being read or isn't specific enough.

### Research Caveats

- Human-written files outperform LLM-generated ones (ETH Zurich: +4% success).
- Auto-generated files that duplicate README content *reduce* task success.
- AGENTS.md works best on tasks under 100 lines changed, 5 files or fewer (Princeton study scope).
- Results vary by model: Claude, Codex, and Qwen-2.5-Coder respond differently to the same file.

### The Practical Test

1. Open your CLAUDE.md
2. Read it top to bottom
3. For every rule, ask: "Would an agent get this wrong without being told?"
4. If the answer is no — or if the agent can figure it out from `package.json` — delete it
5. Count the lines. If over 250, start splitting.

---

## References

- [Claude Code Memory Docs](https://code.claude.com/docs/en/memory) — Official Anthropic doc on CLAUDE.md files, rules, auto memory
- [AGENTS.md Open Standard](https://agents.md/) — Linux Foundation / Agentic AI Foundation
- [Princeton Study: AGENTS.md Efficiency](https://arxiv.org/abs/2601.20404) — 28.6% runtime reduction
- [ETH Zurich Study: Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988) — Context files can reduce success
- [GitHub: How to Write a Great AGENTS.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/) — 2,500-repo analysis
- [Karpathy on Context Engineering](https://x.com/karpathy/status/1937902205765607626) — Context as system output
- [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — SKILL.md guidelines
- [CLAUDE.md and AGENTS.md, In Depth (Redreamality)](https://redreamality.com/blog/claude-md-agents-md-deep-dive/) — Comprehensive 2026 survey
- [Writing a Good CLAUDE.md (HumanLayer)](https://www.humanlayer.dev/blog/writing-a-good-claude-md) — 60-line anchor
- [Claude Code Best Practice (shanraisshan)](https://github.com/shanraisshan/claude-code-best-practice) — Community reference