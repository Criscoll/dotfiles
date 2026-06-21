# SvelteKit Structure

## File Naming

| File | Purpose | Runs |
|---|---|---|
| `+page.svelte` | Page component | Client & Server (SSR) |
| `+page.ts` | Universal load (runs on both) | Client & Server |
| `+page.server.ts` | Server load + form actions | Server only |
| `+layout.svelte` | Layout wrapper for child routes | Client & Server |
| `+layout.ts` | Universal load for layout | Client & Server |
| `+layout.server.ts` | Server load for layout (auth, user data) | Server only |
| `+error.svelte` | Error boundary | Client & Server |
| `+server.ts` | API endpoint (returns Response) | Server only |

## Route Parameters

| Pattern | Matches |
|---|---|
| `[id]` | Single segment: `/posts/123` |
| `[[optional]]` | Optional: `/search` or `/search/svelte` |
| `[...rest]` | Rest: `/docs/a/b/c` |
| `(group)` | Groups routes without URL impact |

## Directory Example

```
src/routes/
├── +layout.svelte              # Root layout (all pages)
├── +page.svelte                # /
├── +error.svelte               # Root error boundary
├── (app)/                      # Route group (no URL impact)
│   ├── +layout.server.ts       # Auth check — redirect if not logged in
│   ├── +layout.svelte          # App layout
│   ├── dashboard/+page.svelte  # /dashboard
│   └── settings/+page.svelte   # /settings
├── (marketing)/
│   ├── +layout.svelte          # Marketing layout
│   ├── about/+page.svelte      # /about
│   └── pricing/+page.svelte    # /pricing
└── api/
    └── posts/+server.ts        # GET/POST /api/posts
```

## Layout Pattern

Every layout must declare `children` in `$props()` and render with `{@render children()}`:

```svelte
<!-- +layout.svelte -->
<script>
    let { children, data } = $props();
</script>

<nav><!-- Navigation --></nav>
<main>{@render children()}</main>
<footer><!-- Footer --></footer>
```

- Root layout wraps **all** pages
- Nested layouts form a hierarchy: root → section → page
- `(group)` folders organize routes without affecting URLs — use to separate auth boundaries or layouts
- Don't use `@` layout resets (deprecated in SvelteKit 2+); use layout groups instead

## Error Boundaries

`+error.svelte` must be placed **above** the failing route in the directory hierarchy:

```svelte
<!-- +error.svelte -->
<script>
    import { page } from '$app/stores';
    import { dev } from '$app/environment';
</script>

<h1>{$page.status}</h1>
<p>{$page.error.message}</p>

{#if dev}
    <pre>{JSON.stringify($page.error, null, 2)}</pre>
{/if}
```

Placement rules:
- Always have a root `src/routes/+error.svelte` as a fallback
- Errors bubble up to the nearest boundary — `+error.svelte` at the same level catches page errors; layout errors need a boundary one level up
- Throw errors in `load` functions (`throw error(404, 'Not found')`), not in component script

## Special Files

- `hooks.server.ts` — runs on every request (`handle` function, `handleError`)
- `hooks.client.ts` — client-side lifecycle hooks
- `app.html` — HTML shell template
- `src/params/*.ts` — route parameter validators
