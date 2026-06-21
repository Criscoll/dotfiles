# Language and Framework Skill Conventions

Reference when authoring a skill for a programming language, framework, library, or technology stack.

## Core Principle: The Model Already Knows Syntax

Coding agents are fluent in mainstream language syntax and standard libraries. A skill that documents syntax wastes tokens.

**Encode only what training data cannot capture:**
- Project-specific toolchain choices (uv vs pip, pnpm vs npm)
- Framework-specific gotchas the model consistently gets wrong
- Anti-patterns specific to the version in use (Svelte 4 vs 5, React class vs hooks)
- Exact import paths (models hallucinate import paths)
- Testing conventions specific to the project
- Deployment/hosting specifics

## Description — Negative Triggers

Language skill descriptions must include negative triggers to prevent false fires in irrelevant contexts.

**Weak:**
```yaml
description: Svelte development best practices.
```

**Strong (with negative trigger):**
```yaml
description: >-
  Svelte 5 / SvelteKit best practices. Auto-invoke BEFORE writing any .svelte file
  or SvelteKit route file. Not for plain TypeScript/JavaScript files, not for React
  or Vue. Trigger phrases: "svelte", "$state", "$props", "+page", "sveltekit".
```

Pattern: `"Not for X, not for Y"` clause after the auto-invoke condition, before trigger phrases.

## Size Guidelines

| Skill type | Target size |
|---|---|
| Language / framework skill | 50–80 lines |
| Workflow skill (web-search, pdf-parse) | 200–500 lines |

Language skills are **constraint-oriented** (prefer X over Y) not **workflow-oriented** (step 1, step 2). Keep them small.

## Decision Table Pattern

Use compact inline tables for "Which X?" decisions — the most common agent query in language contexts.

```markdown
**Which file?** Server-only (DB/secrets): `+page.server.ts` |
Universal (runs both): `+page.ts` | API: `+server.ts`
```

Or as a full table when there are more than 3 options:

```markdown
| Situation | Use | Why |
|---|---|---|
| Need DB / secrets | `+page.server.ts` | Server-only, never sent to client |
| Runs on both | `+page.ts` | Re-runs on client navigation |
| API endpoint | `+server.ts` | Returns Response, not page data |
```

## Anti-Pattern Pair Format

Name what to avoid and its replacement side by side:

```markdown
| Avoid (old pattern) | Use instead |
|---|---|
| `export let prop` | `let { prop } = $props()` |
| `on:click={handler}` | `onclick={handler}` |
```

Or inline:
```markdown
- Do: `$derived(expr)` — Avoid: `$:` reactive statements
- Do: `onclick={handler}` — Avoid: `on:click={handler}` (Svelte 4 legacy)
```

## "Last Verified" Metadata

Add at the bottom of every language SKILL.md:

```markdown
<!-- last-verified: YYYY-MM-DD framework-version -->
```

Example: `<!-- last-verified: 2026-06-21 svelte5/sveltekit2 -->`

Lets the next editor know whether the skill is trustworthy against the current version.

## Priority Domains (P0/P1/P2)

When deciding what to include in a language skill, prioritize by domain:

**P0 — Always include:**
- Core idioms and gotchas
- Architecture / project structuring
- Security practices specific to the framework
- Data access patterns
- Error handling conventions

**P1 — Include if the project uses them:**
- Testing patterns (runner, mocking conventions)
- Performance optimisation
- Deployment / build config
- State management

**P2 — Reference file only:**
- Tooling configuration details
- Upgrade guides
- i18n

## Split vs. Monolithic

**Split into multiple skills when:**
- The framework has distinct subsystems the model gets wrong independently
- A monolithic skill would exceed ~150 lines
- Different triggers activate different parts

**Keep as one skill when:**
- The domain is small and tightly coupled
- Total instructions fit in 80 lines with a unified trigger

Use progressive disclosure (reference files) as an alternative to splitting — one SKILL.md with load-on-demand reference files avoids managing multiple skill directories while still keeping context lean.
