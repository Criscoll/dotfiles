# Install Svelte Skills & Update skill-author for Language Skills

Date: 2026-06-21
Status: Implemented 2026-06-21

## Outcome

- **Phase 1:** Created `stow-managed/.claude/skills/svelte-knowledge/` as a single unified skill (SKILL.md + 3 reference files: sveltekit-structure.md, sveltekit-data-flow.md, svelte-deployment.md). Content synthesised from spences10/skills source. Stowed and live.
- **Phase 2:** Added `stow-managed/.claude/skills/skill-author/references/language-skills.md` and wired it into skill-author/SKILL.md's load table.
- **Phase 3:** Added negative triggers and `<!-- last-verified -->` to python-knowledge and typescript-knowledge SKILL.md files.

Open questions answered by implementation:
- MCP (`@sveltejs/mcp`): not installed — SKILL.md-only approach is sufficient
- Vendored vs `gh skill install`: vendored (content synthesised into our own files)
- `svelte-code-writer`: skipped — wraps MCP CLI which we don't use
- Fork strategy: de facto fork (copied content into repo, no upstream sync)

---

## Context

During research into what makes a good per-language agent skill (see `docs/language-skill-conventions.md`), we discovered an established community consensus and an official Svelte ecosystem of agent skills. The dotfiles repo already has `python-knowledge` and `typescript-knowledge` skills but lacks any Svelte/SvelteKit skills.

Given our only SvelteKit project (scribbles) is currently inactive, this is deferred but well-understood. When the project reactivates, the skills should be installed to prevent the model from repeatedly generating Svelte 4 patterns in a Svelte 5 project.

## What Was Discovered

### The Official Svelte Ecosystem

The **sveltejs/ai-tools** repo and **spences10/skills** both maintain a decomposed set of Svelte skills:

| Skill | Covers | Notes |
|---|---|---|
| `svelte-core-bestpractices` | Runes, events, snippets, styling, legacy avoidance | Official, from sveltejs/ai-tools |
| `svelte-runes` | Rune selection, reactivity patterns, component API | spences10 variant, ~50 lines |
| `svelte-components` | Bits UI, Ark UI, custom elements, form patterns | spences10 |
| `svelte-template-directives` | @attach vs use: actions, @html, @render | spences10, references new Svelte 5.29+ feature |
| `svelte-styling` | Scoped CSS, style: directive, CSS custom properties | spences10 |
| `svelte-deployment` | Adapters, Vite config, pnpm setup, library authoring | spences10 |
| `sveltekit-structure` | Route file naming, nested layouts, error boundaries | spences10 |
| `sveltekit-data-flow` | Load functions, form actions, serialization, invalidation | spences10 |
| `sveltekit-remote-functions` | query(), query.live(), form(), command(), prerender() | Experimental feature, may not be needed |

### Why Decomposed Works Better

Our existing `python-knowledge` is a single monolithic skill that covers toolchain, type checking, formatting, testing, and file-naming all in one file. It works because Python itself is homogeneous — there's one package manager choice (uv), one type checker (mypy), one formatter (ruff).

Svelte has more moving parts: runes (reactivity model), routing (SvelteKit structure), deployment (adapters vary by platform), template directives (Svelte 5 API is new), each with different trigger conditions. A single monolithic skill would either:
- Not trigger correctly (description can't cover all triggers concisely)
- Waste tokens loading irrelevant detail (deployment adapter instructions when the task is just adding a prop)

The community split — 11 separate skills — is the right pattern for framework skills.

### What skill-author Currently Lacks

The existing `skill-author` skill knows how to create a SKILL.md following the Agent Skills standard format. It does **not** encode the language/framework skill conventions documented in `docs/language-skill-conventions.md`. Specifically:

- No guidance on using decision tables ("Which X?") for choosing between alternatives
- No guidance on including "do this / don't do this" anti-pattern pairs
- No guidance on negative triggers in the description
- No guidance on keeping language skills small (50-80 lines) vs workflow skills (200-500 lines)
- No guidance on splitting by concern rather than keeping monolithic
- No guidance on "last verified" metadata

## Why Do This

1. **Correctness** — The model writes Svelte 4 patterns (`export let`, `on:click`, `<slot>`) in Svelte 5 projects without guidance. A skill prevents this.
2. **Context efficiency** — ~50-line focused skills cost almost nothing to trigger but save significant wasted code generation and debugging.
3. **Pattern consistency** — Once we establish the decomposed approach for Svelte, the same pattern can be applied to other frameworks (React/Next.js, etc.) as they're adopted.
4. **skill-author improvement** — The skill-author skill is the natural place to encode skill authoring best practices. Updating it propagates to all future skill creation.

## What Would Be Involved

### Phase 1: Install Svelte Skills

1. Read the source files from spences10/skills (or sveltejs/ai-tools releases page) for the subset we want
2. Create skill directories under `stow-managed/.claude/skills/` for each
3. Validate that our `python-knowledge` and `typescript-knowledge` remain compatible with the conventions doc (they both predate these conventions)

**Subset decision:** Which skills to install?
- `svelte-core-bestpractices` — mandatory (anti-patterns, runes, events)
- `svelte-runes` — if we prefer spences10's version over the official one
- `sveltekit-structure` — mandatory for routing/layouts
- `sveltekit-data-flow` — mandatory for load/form/invalidation
- `svelte-template-directives` — useful if project uses @attach (Svelte 5.29+)
- `svelte-deployment` — useful but depends on which adapter the project uses
- `svelte-styling` — lowest priority, model handles CSS well
- `svelte-components` — depends on whether project uses Bits UI/Ark UI
- `sveltekit-remote-functions` — only if project uses experimental remote functions

**Watch out for:**
- spences10/skills includes reference/ files. Those reference files use relative paths to scripts/assets that may not exist in our copy. Verify each skill is self-contained before committing.
- The official sveltejs/ai-tools skills reference `@sveltejs/mcp` CLI tool (`npx @sveltejs/mcp`). May want this: install `@sveltejs/mcp` as a dependency or as an MCP server.

### Phase 2: Update skill-author

1. Read the existing `skill-author` SKILL.md
2. Add a section on language/framework skill conventions drawing from `docs/language-skill-conventions.md`
3. Specifically encode:
   - Description trigger optimisation with negative triggers
   - Decision table pattern for "Which X?"
   - Anti-pattern pair format
   - Progressive disclosure for reference files
   - Last-verified metadata
   - When to split vs keep monolithic
4. Add a review step that cross-references the conventions

### Phase 3: Audit Existing Language Skills

1. Review `python-knowledge` against the conventions doc — does it follow the patterns?
2. Review `typescript-knowledge` against the conventions doc — does it follow the patterns?
3. Update both if they violate the conventions (e.g., missing negative triggers, no last-verified, too monolithic)

## When to Proceed

The right time is **when the scribbles project reactivates** or when any new Svelte/SvelteKit project is started. Before then, these skills would sit unused and potentially go stale.

Exception: Phase 2 (updating skill-author) could be done independently — it's a small, contained change that improves all future skill creation regardless of language.

## Open Questions

1. Should we install `@sveltejs/mcp` as a permanent dependency, or rely on the SKILL.md-only conventions from spences10?
2. Should we vendor the skills (copy files into our repo) or install via `gh skill install` at bootstrap time?
3. The spences10 skills include `svelte-code-writer` which wraps the MCP CLI — does this conflict with the terminal-less way pi runs?
4. Should we maintain our own fork of the Svelte skills or track upstream? If we need to customise them, forking and adding a sync note is better.