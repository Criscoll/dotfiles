# gws-cli Filter-Creation OAuth Scope Limitation

## Context

The gmail label/filter wrapper set (`gmail-create-label`, `gmail-update-label`,
`gmail-filters`, `gmail-get-filter`, `gmail-create-filter`, `gmail-backfill` in
`stow-managed/bin/agent_scripts/`) was built and verified 2026-09-28. Everything
works **except `gmail-create-filter`**, which fails with:

```
Gmail API error: Request had insufficient authentication scopes.
```

`gmail-filters` (list) and `gmail-get-filter` (get) work fine under the current
grant — only filter **creation** is blocked. (Verified: a bogus filter ID via
`gmail-get-filter` returns a proper 404 "Filter not found", not a scope 403.)

## Root Cause

The Gmail API filters endpoints require the `gmail.settings.basic` scope.
gws-cli 1.3.1's scope map (`gws/auth/scopes.py`) requests only:

```python
"gmail": ["https://www.googleapis.com/auth/gmail.modify"],
```

The scope list is reconstructed on every call from
`get_scopes_for_services(config.enabled_services, read_only)` — hardcoded per
service, with **no config key, env var, or hook** to extend it. OAuth grants
only what the client requests, so the `gmail.settings.basic` scope can never
be granted to a stock gws-cli client, no matter how many times the user
re-consents.

Why read-works/write-fails: Google's enforcement evidently permits
`filters.list`/`filters.get` under the granted gmail scopes but requires
`settings.basic` for `filters.create` (docs list `settings.basic` for all
three, but enforcement is what we observed).

## Why the Naive Fixes Don't Work

- **Re-auth / re-consent (stock gws-cli):** the consent flow only offers the
  scopes the client requests. `settings.basic` is never among them.
- **Fat-token injection:** minting a token that includes `gmail.settings.basic`
  and writing it into gws-cli's encrypted token store does not survive —
  gws-cli reconstructs credentials with its *own* scope list on every refresh
  (confirmed behaviour in `gws/auth/oauth.py::_get_required_scopes`), so the
  next access token is re-narrowed to `gmail.modify`. Refresh requests a subset
  of what was granted, which succeeds — but the API calls then carry only
  `gmail.modify` again.

## Durable Fix Options

1. **Upstream PR** (googleworkspace/cli): add `gmail.settings.basic` to the
   gmail scope map, or introduce a separate `gmail-settings` service entry.
   Cleanest; timeline depends on the maintainer. Then: bump all gmail wrapper
   pins, one re-consent, done. (Precedent: this repo already tracks upstream
   issue cli#119 about the same scope map.)
2. **Local fork:** patch `gws/auth/scopes.py`, pin the fork in the wrappers
   via `uvx --from <git-or-local-path>`. Works today; every future version
   bump rebases one patch.
3. **Standalone wrapper with its own OAuth mint** (user's preferred direction,
   deferred): a dedicated `gmail-create-filter` replacement that does its own
   scope-restricted OAuth flow — same `client_secret.json`, requesting
   `gmail.settings.basic` explicitly, storing its token separately (e.g.
   `~/.config/gmail-filter-wrapper/`). This is effectively Option A of
   `ideas/gmail-filter-management.md` narrowed to filters: a PEP 723 script
   with `google-api-python-client` + `google-auth-oauthlib` as inline deps.
   Cost: a second credential store and auth flow on each machine; benefit:
   no fork maintenance.

## Current State (2026-09-28)

- Wrapper exists and is correct; it 403s at the API layer. The limitation is
  documented in
  `stow-managed/.claude/skills/google-workspace/gmail.md` (Moving / Organizing
  caveat) and the SKILL.md description, so agents don't burn API calls
  retrying.
- Filters must be created in the Gmail UI (Settings → Filters) until a fix
  lands; the agent can then list/inspect them via the working wrappers.
- No filters exist on the account yet.

## Next Steps

1. Decide: upstream PR vs fork vs standalone mint.
2. If standalone mint: write the PEP 723 script, request only
   `gmail.settings.basic` (+ nothing else needed), reusing the gws-cli client
   credential via `gws auth import-credentials`-style import into its own
   store. Reconcile with the filter-JSON export/import idea in
   `ideas/gmail-filter-management.md`.
3. If upstream: draft the issue/PR; when released, bump pins (13 wrapper
   scripts pin `gws-cli@1.3.1`) and re-consent once.