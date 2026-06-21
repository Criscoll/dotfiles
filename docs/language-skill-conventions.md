# Language and Framework Skill Conventions

Date: 2026-06-21
Sources: community skill repos (spences10/skills, HoangNguyen0403/agent-skills-standard, sveltejs/ai-tools), Claude skill authoring docs, mgechev/skills-best-practices, VoltAgent/awesome-agent-skills, observed patterns across 20+ production skills.

---

## What This Documents

Conventions for writing per-language and per-framework agent skills. These conventions were discovered by surveying the community's most lauded skill collections and extracting what works. They answer the question: **what should a language skill teach an agent that the model doesn't already know from training data?**

## Core Principle: The Model Already Knows Syntax

This is the single most important insight from the community. Coding agents (Claude, GPT-4, etc.) are already fluent in every mainstream language's syntax, standard library, and common idioms. A skill that documents syntax is wasted tokens.

**The value of a language skill comes from encoding what training data can't capture:**
- Project-specific toolchain choices (uv vs pip, pnpm vs npm, nvm vs fnm)
- Framework-specific gotchas that the model consistently gets wrong
- Exact import paths (models hallucinate paths constantly)
- Anti-patterns specific to the version in use (Svelte 4 vs 5, React class vs hooks vs server components)
- Testing conventions (which runner, where mocks live, what patterns are idiomatic for this project)
- Deployment/hosting specifics (adapters, platform gotchas)

## Anatomy of a Good Language Skill

### 1. Description — Trigger-Optimised, Third Person

The description is the skill's only metadata the agent sees before activating it. Everything hinges on this.

**Rules:**
- Third person only (injected into system prompt — first/second person breaks discovery)
- List explicit trigger phrases and contexts
- Include "Auto-invoke BEFORE X" and "Trigger phrases: Y" patterns
- **Include negative triggers** — "Do NOT use for React/Next.js projects" prevents false fires

**Weak:**
```yaml
description: Svelte development best practices.
```

**Strong (from spences10's svelte-runes):**
```yaml
description: "Implement Svelte 5 runes correctly. Use for reactive state, props, effects, $state.raw, $derived.by, $props, and $bindable."
```

**Stronger (negative trigger added):**
```yaml
description: "Svelte 5 runes guidance. Use for reactive state, $state, $derived, $effect, $props, and $bindable. Not for Svelte 4 or component styling."
```

### 2. Quick Start — The First Thing the Agent Reads

Lead with a short reference that covers the most common decision points. A table or a single code block. This gives the agent an immediate win before diving into details.

**Pattern (from svelte-runes):**
```markdown
## Quick Start

**Which rune?** Props: `$props()` | Bindable: `$bindable()` |
Computed: `$derived()` | Side effect: `$effect()` | State: `$state()`

**Key rules:** Runes are top-level only. $derived can be overridden
(use `const` for read-only). Objects/arrays are deeply reactive by
default; use `$state.raw` for large data replaced wholesale.

## Example

```svelte
<script>
	let count = $state(0);
	const doubled = $derived(count * 2);
	$effect(() => console.log(`Count is ${count}`));
</script>

<button onclick={() => count++}>
	{count} (doubled: {doubled})
</button>
```

### 3. Decision Tables — The "Which X" Pattern

Language skills are most useful when they help the agent choose between competing approaches. Decision tables are the cleanest way to encode this.

**Pattern (from sveltekit-data-flow):**
```markdown
**Which file?** Server-only (DB/secrets): `+page.server.ts` |
Universal (runs both): `+page.ts` | API: `+server.ts`

**Load decision:** Need server resources? → server load | Need client
APIs? → universal load

**Form actions:** Always `+page.server.ts`. Return `fail()` for
errors, throw `redirect()` to navigate, throw `error()` for failures.
```

### 4. Most-Common-Mistakes Section

Models repeat certain errors across sessions. Call these out explicitly with "do this / don't do this" pairs.

**From svelte-core-bestpractices (official sveltejs/ai-tools):**
```markdown
## `$effect`

Effects are an escape hatch and should mostly be avoided. In particular,
avoid updating state inside effects.

- If you need to compute something from state, use `$derived`
- If you need to sync state to an external library, use `{@attach ...}`
- If you need to run code in response to user interaction, put it in an event handler
- If you need to log values for debugging, use `$inspect`
```

### 5. Anti-Patterns Checklist

Name the specific patterns to avoid, with the replacement side by side.

**From svelte-core-bestpractices ("Avoid legacy features"):**
```markdown
- use `$state` instead of implicit reactivity (e.g. `let count = 0; count += 1`)
- use `$derived` and `$effect` instead of `$:` assignments
- use `$props` instead of `export let`, `$$props` and `$$restProps`
- use `onclick={...}` instead of `on:click={...}`
- use `{#snippet ...}` and `{@render ...}` instead of `<slot>`
```

### 6. Progressive Disclosure via Reference Files

SKILL.md stays under 500 lines. Reference files hold detail. Files at most one level deep from SKILL.md.

**Pattern (from spences10's svelte-runes):**
```markdown
## Reference Files

- [reactivity-patterns.md](references/reactivity-patterns.md) — When to use each rune
- [component-api.md](references/component-api.md) — $props, $bindable patterns
- [common-mistakes.md](references/common-mistakes.md) — Anti-patterns with fixes
```

### 7. "Last Verified" Metadata

Timestamp the skill against the version it documents. Languages and frameworks evolve — a staleness indicator lets the next editor know whether the skill is trustworthy.

**Pattern:**
```yaml
metadata:
  last_updated: "2026-06-21"
  verified_against: "Svelte 5 official docs and sveltejs/svelte#18282"
```

## What the Best Skill Collections Cover

From the HoangNguyen0403/agent-skills-standard priority system, the domains per language/framework in order of priority:

**P0 (Foundation — always needed):**
- Core language idioms and gotchas
- Architecture / project structuring
- Security practices specific to the framework
- Data access patterns
- Error handling conventions

**P1 (Operational — needed during implementation):**
- Testing patterns (which runner, mocking conventions)
- Performance optimisation
- Deployment / build config
- State management
- Observability

**P2 (Maintenance — needed occasionally):**
- Tooling configuration
- Upgrade guides
- i18n
- Documentation generation

## How Language Skills Differ from General Skills

General-purpose skills (web-search, pdf-parse, browser-inspect) are task-oriented — they encode a workflow for a specific capability. Language skills are **constraint-oriented** — they encode the boundaries within which the model should operate.

This means language skills should:
- Be smaller and more focused (50-80 lines is ideal vs 200-500 for workflow skills)
- Focus on "prefer X over Y" and "this works but that doesn't" — not "step 1, step 2"
- Be split by concern, not monolithic — separate runes from routing from deployment
- Never document standard library functions or language syntax (the model knows these)
- Document exact import paths with version pins (models hallucinate import paths)

## When to Split vs Merge

**Split into multiple skills when:**
- The framework has distinct subsystems the model gets wrong independently (e.g. Svelte runes ≠ SvelteKit data flow ≠ SvelteKit deployment)
- A monolithic skill would exceed 150 lines
- Different triggers activate different parts — routing questions shouldn't load deployment details

**Keep as one skill when:**
- The domain is small and tightly coupled
- Splitting would create cross-skill dependencies
- The total instructions fit in 80 lines and have a unified trigger

## Known Community Collections

| Collection | Languages/Frameworks | Approach |
|---|---|---|
| HoangNguyen0403/agent-skills-standard | 9 languages/frameworks (Go, Java, Kotlin, PHP, Swift, React Native, NestJS, Next.js, Spring Boot, Laravel) | P0/P1/P2 priority per framework, 20+ skills per framework, decomposed by concern |
| spences10/skills | Svelte/SvelteKit (11 skills) | Mirrors official sveltejs/ai-tools, decomposed by concern, ~50 lines each |
| sveltejs/ai-tools | Svelte/SvelteKit (2 skills + MCP tools) | Official, ships as Claude Code plugin + OpenCode plugin |
| VoltAgent/awesome-agent-skills | 1000+ skills across all ecosystems | Community-curated directory, mixed quality |