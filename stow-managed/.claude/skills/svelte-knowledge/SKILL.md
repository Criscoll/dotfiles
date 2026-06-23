---
name: svelte-knowledge
description: >-
  Apply Svelte 5 / SvelteKit best practices when reading, writing, debugging,
  or understanding Svelte code. Auto-invoke BEFORE writing any .svelte,
  .svelte.ts, or .svelte.js file, or editing any SvelteKit route file. Not for
  plain TypeScript/JavaScript files without Svelte, not for React, Vue, or other
  frameworks. Trigger phrases: "svelte", "sveltekit", ".svelte", "svelte
  component", "rune", "$state", "$props", "$derived", "$effect", "svelte 5",
  "kit", "+page", "+layout", "+error", "load function", "form action",
  "use:enhance", "snippets", "$bindable",
  "fix a component", "edit a prop", "add a prop to", "update the template",
  "update a Svelte component", "change a Kpi", "modify the card".
disable-model-invocation: false
---

You are assisting with Svelte 5 / SvelteKit code. Apply the following core rules, then load additional reference files as directed below.

## Always Apply

**Runes — which to use:**

| Rune | Use for |
|---|---|
| `$state(val)` | Local mutable state that affects template output |
| `$state.raw(val)` | Large objects/arrays replaced wholesale (avoids deep proxy overhead) |
| `$derived(expr)` | Computed value — use `const` for read-only, `let` to allow reassignment |
| `$derived.by(() => ...)` | Multi-line derivation |
| `$effect(() => ...)` | Side effects only — escape hatch, avoid updating state inside |
| `$props()` | Destructure props: `let { foo, bar = 'default' } = $props()` |
| `$bindable(val)` | Props the parent can bind to with `bind:prop={val}` |

**Events:** Use `onclick={handler}` not `on:click={handler}`. The `on:event` directive is Svelte 4 legacy syntax.

**Snippets over slots:** Use `{#snippet name()}` / `{@render name()}`. `<slot>` is Svelte 4 legacy. Layouts use `let { children } = $props()` and `{@render children()}`.

**Anti-patterns — Svelte 4 → Svelte 5:**

| Avoid (Svelte 4) | Use instead (Svelte 5) |
|---|---|
| `export let prop` | `let { prop } = $props()` |
| `on:click={handler}` | `onclick={handler}` |
| `<slot>` / `<slot name="x">` | `{@render children()}` / `{#snippet x()}...{/snippet}` |
| `$:` reactive statements | `$derived(expr)` or `$effect(() => { ... })` |
| `<svelte:component this={C}>` | `<C />` directly |
| `{@const x = ...}` | `{const x = ...}` (declaration tag) |
| `setContext`/`getContext` | `createContext` for typed context |

**Effects rule:** Never update state inside `$effect`. Effects do not run on the server — do not wrap bodies in `if (browser)` as a workaround.

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/sveltekit-structure.md** — load when: route file naming, layouts, `+page.svelte`, `+layout.svelte`, `+error.svelte`, nested routes, route groups `(name)`, SvelteKit directory structure, error boundaries.
- **references/sveltekit-data-flow.md** — load when: `load()` functions, `+page.server.ts`, `+page.ts`, form actions, `$page.data`, `invalidate()`, `invalidateAll()`, serialization, `use:enhance`, server vs universal load.
- **references/svelte-deployment.md** — load when: adapters, `vite.config.ts`, `svelte.config.js`, deployment target, pnpm setup, production builds, static site, Node server, Cloudflare, Vercel.

<!-- last-verified: 2026-06-21 svelte5/sveltekit2 -->
