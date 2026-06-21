# Svelte Deployment

## Config Location

Prefer `vite.config.ts` for Kit options in SvelteKit 2+. `svelte.config.js` is optional and **will not be read in Kit 3**.

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-auto';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        sveltekit({
            adapter: adapter(),
        }),
    ],
});
```

## Adapter Selection

| Target | Package | Notes |
|---|---|---|
| Auto-detect (Vercel/Netlify/Cloudflare) | `@sveltejs/adapter-auto` | Works for most cloud platforms |
| Static site (no SSR) | `@sveltejs/adapter-static` | Generates plain HTML/JS/CSS |
| Node.js server | `@sveltejs/adapter-node` | Self-hosted Node |
| Cloudflare Pages | `@sveltejs/adapter-cloudflare` | Edge runtime |
| Vercel (explicit) | `@sveltejs/adapter-vercel` | When auto doesn't give enough control |

```bash
pnpm add -D @sveltejs/adapter-node
```

## pnpm 10+

`postinstall` is disabled by default in pnpm 10. Add a prepare script so `svelte-kit sync` runs:

```json
{
    "scripts": {
        "prepare": "svelte-kit sync"
    }
}
```

## Static Adapter Config

```typescript
// vite.config.ts — static adapter
import adapter from '@sveltejs/adapter-static';

export default defineConfig({
    plugins: [
        sveltekit({
            adapter: adapter({
                pages: 'build',
                assets: 'build',
                fallback: 'index.html', // For SPA mode
            }),
        }),
    ],
});
```

For static output, all `load` functions must be universal (`+page.ts`) — no server-only code.

## Cloudflare Gotcha

Cloudflare may strip `Transfer-Encoding: chunked`, breaking streaming responses. Avoid streaming when targeting Cloudflare Workers/Pages, or use `adapter-cloudflare` with explicit streaming support.

## Environment Variables

Prefer explicit env vars via `$app/env/private` (server-only) and `$app/env/public` (safe for client) when the experimental flag is enabled. Never expose private env vars through universal load or client-side code.
