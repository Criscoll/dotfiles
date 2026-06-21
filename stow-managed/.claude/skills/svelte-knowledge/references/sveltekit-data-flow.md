# SvelteKit Data Flow

## Which File?

| Need | File | Why |
|---|---|---|
| DB access, secrets, server packages | `+page.server.ts` | Server-only, never sent to client |
| Runs on both client and server | `+page.ts` | Re-runs on client navigation |
| API endpoint | `+server.ts` | Returns `Response`, not page data |
| Form actions | `+page.server.ts` | Actions are always server-side |

Data flow: `+page.server.ts` → (output becomes `data` param) → `+page.ts` → (merged output) → `+page.svelte` (`data` prop).

## Load Functions

```typescript
// +page.server.ts — server-only load
import { error } from '@sveltejs/kit';

export const load = async ({ locals, params }) => {
    const post = await db.posts.findById(params.id);
    if (!post) throw error(404, 'Not found');
    return { post }; // Must be JSON-serializable — see Serialization below
};
```

```typescript
// +page.ts — universal load (runs server-side on first load, client-side on navigation)
export const load = async ({ data, fetch, depends }) => {
    depends('app:stats'); // Re-run on invalidate('app:stats')
    const stats = await fetch('/api/stats').then(r => r.json());
    return { ...data, stats }; // data comes from +page.server.ts
};
```

Common mistakes:
- Don't import `$lib/server/*` from `+page.ts` — only `+page.server.ts` can
- Don't use `window`/`localStorage` without checking `if (browser)` from `$app/environment`

## Form Actions

```typescript
// +page.server.ts
import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    // Default action — invoked with method="POST" (no action attribute)
    default: async ({ request }) => {
        const data = await request.formData();
        const email = data.get('email');

        if (!email) return fail(400, { email, missing: true }); // Return fail(), don't throw

        await save(email);
        throw redirect(303, '/success'); // MUST throw, not return
    },

    // Named action — invoked with action="?/login"
    login: async ({ request, locals }) => {
        if (!locals.user) throw error(401, 'Unauthorized'); // MUST throw
        // ...
    },
};
```

```svelte
<!-- +page.svelte -->
<script>
    import { enhance } from '$app/forms';
    let { form } = $props(); // Contains return value from action (fail() result)
</script>

<form method="POST" use:enhance>
    <input name="email" value={form?.email ?? ''} />
    {#if form?.missing}<p class="error">Required</p>{/if}
    <button>Submit</button>
</form>
```

Critical rules:
- Always `throw redirect()` and `throw error()` — never `return` them
- `fail()` is **returned** (not thrown) to show validation errors back in `form`
- If you catch exceptions, rethrow any `Redirect` or `HttpError` instances

## Invalidation

```typescript
import { invalidate, invalidateAll } from '$app/navigation';

invalidate('app:posts');   // Re-runs any load that called depends('app:posts')
invalidateAll();           // Re-runs all load functions for the current page
```

Mark a load function's dependency: call `depends('app:posts')` inside it. The string can be any identifier — use `app:` prefix as convention to avoid clashing with URL-based invalidation.

## Accessing Page Data in Components

```svelte
<script>
    import { page } from '$app/stores';
</script>

<!-- $page.data — merged output from all active load functions -->
<p>Hello {$page.data.user?.name}</p>

<!-- $page.url, $page.params, $page.status -->
<p>Path: {$page.url.pathname}</p>
```

## Serialization Constraints

Server load and form actions must return **JSON-serializable data only** — the data crosses the server/client boundary as JSON:

| Avoid | Use instead |
|---|---|
| `new Date()` | `date.toISOString()` |
| `undefined` | `null` |
| Class instances with methods | Plain objects `{ id, name, ... }` |
| `Map` | `Object.fromEntries(map)` |
| `Set` | `Array.from(set)` |
| Functions | Don't return functions from server load |
| `BigInt` | Convert to string |

SvelteKit throws at runtime if you return non-serializable data — the error message includes the path of the offending value.
