# Auth Troubleshooting

Three distinct auth failures show up as "it's asking me to log in again." They have
different causes and different fixes — check the error string first, and for
`invalid_scope` specifically, check account type before assuming it's the generic case.

## `invalid_grant` — Testing-mode 7-day cap

**Symptom:** auth from the main setup steps works, but expires and demands a fresh
OAuth flow every 7 days or so, on every machine.

**Cause:** the OAuth client's Google Cloud project has Publishing status =
**Testing**. Google hard-caps refresh tokens at 7 days for any External app in
Testing status, regardless of which scopes it requests. This is a project-level
setting (shared by every machine using the same `client_secret.json`), not a
per-machine one.

**Fix (one-time, project-level):**

1. Go to `console.cloud.google.com/auth/audience` (select the correct project
   in the top bar first). Google merged the old "OAuth consent screen" page into
   **Google Auth Platform**, split across Branding / Audience / Data Access tabs
   — the publishing-status control now lives under **Audience**, not a page
   literally named "consent screen." If the project never had a consent screen
   configured interactively, that URL will prompt **Get Started** — step through
   App name → Audience (choose **External**) → Contact info → agree to the
   policy → Create, then return to `/auth/audience`.
2. Click **Publish App**, confirm the dialog. Status flips from Testing to
   **In production**.

**Then, per machine:** tokens minted *before* publishing keep their 7-day cap
even after the project is published — each machine needs one more re-auth pass
to mint a token issued post-publish:

```bash
rm ~/.config/gws-cli/token.json.enc   # skip if the file doesn't exist yet
OAUTHLIB_RELAX_TOKEN_SCOPE=1 uvx gws-cli@1.3.1 gmail labels
```

**The "Google hasn't verified this app" warning is expected and permanent** —
Published + External + Unverified is the correct end state here, not a
misconfiguration. Click **Advanced → Go to [app name] (unsafe)** every time you
mint a fresh token. Do not submit for Google verification for a single-user
personal tool like this — verification (privacy policy, homepage, review) is
overhead with no benefit when you're the only consenting account.

What "any Google user could access it" (shown in Google's own docs for this
state) actually means: without the Testing allowlist, the consent screen will
accept a login from any Google account, not just pre-approved testers. That
lets someone else who obtained this app's `client_id`/`client_secret` run the
OAuth flow and link *their own* account to it — it does not expose *your*
Gmail/Calendar data to them. Each grant is scoped to whichever account
consents. Since the credential file is only ever stored encrypted at rest and
never committed to this repo, there's no realistic path for anyone else to
have it. A hard cap of 100 total distinct consenting accounts applies to
unverified Published apps — irrelevant for single-user use.

## `invalid_scope` — two different causes, check account type first

**Symptom:** even on a Published (In production) project, a refresh attempt fails:

```
[gws-cli] Warning: token refresh failed: ('invalid_scope: Bad Request', {'error': 'invalid_scope', 'error_description': 'Bad Request'})
```

...followed by a fresh OAuth URL. This is a **different failure mode from the
7-day Testing cap above** — don't confuse the two. `invalid_grant` = expired by
policy; `invalid_scope` = the cached refresh token's scope set no longer matches
what the client is requesting on refresh.

There are two distinct reasons this scope mismatch happens. **Check which one
you're in before picking a fix** — the generic case is genuinely a one-off; the
personal-account case is structural and will recur on every single refresh
until you address it, no matter how many times you re-consent.

### Case A: generic incremental-authorization mismatch (one-off, self-resolving)

**Cause:** the token currently cached on this machine was originally granted for
a *narrower* scope set than what `gws-cli@1.3.1` now requests on every call (the
full list: `gmail.modify`, `calendar`, `drive`, `spreadsheets`, `presentations`,
`documents`, `contacts`, `directory.readonly`). Google's OAuth server rejects
refreshing a token when the request asks for scopes beyond what was originally
granted — this is documented, intentional behavior
(`developers.google.com/identity/protocols/oauth2`: *"just request all your
scopes at once"*), not a bug or a sign the token expired early. This happens
when the pinned `gws-cli` version changes, or the token predates an
`enabled_services` change — see triggers below.

**Fix:** let the fallback flow run — it already starts automatically the moment
refresh fails. Just complete it:

```bash
OAUTHLIB_RELAX_TOKEN_SCOPE=1 uvx gws-cli@1.3.1 gmail labels
```

Open the printed URL, approve, click through **Advanced → Go to [app] (unsafe)**.
The consent screen shows *"[App] already has some access"* and lists only the
*additional* scopes being requested — Google's normal incremental-authorization
screen, not a duplicate or a sign something is broken.

**Why this is a one-off, not recurring** — *conditional on every requested scope
actually being grantable to this account* (see Case B if it isn't):
- The skill pins `gws-cli@1.3.1` exactly, so the scope list the client requests
  is fixed — nothing will silently ask for *more* scopes later on its own.
- Once a token is minted covering the full current scope set, refreshes keep
  matching it indefinitely (Published/External tokens aren't time-boxed).

**What would trigger it again** (all avoidable, none automatic):
1. Bumping the pinned `gws-cli` version to one that requests a different/larger
   scope set — expect one more re-auth pass whenever the pin changes.
2. Editing `enabled_services` in `~/.config/gws-cli/gws_config.json` (or
   running `gws-cli config enable <service>` / `config reset`) to add a service
   whose scope the current token doesn't have yet.
3. ~6 months of total inactivity, explicit revocation, or a Google account
   security event (e.g. password change) — normal token-invalidation triggers,
   unrelated to scopes.

### Case B: personal (non-Workspace) account + admin-only scope — structural, recurs every time

**Symptom that distinguishes this from Case A:** `invalid_scope` keeps coming
back — not months later, not after a version bump, but again within days, even
right after you thought you'd completed the fallback consent flow. Confirmed on
this repo 2026-07-23: a token minted 2026-07-19 (4 days prior, no version
change, no config change) was already broken.

**Cause:** `gws-cli`'s scope map (`gws/auth/scopes.py` in the installed
package) bundles two scopes under the `contacts` service:

```python
"contacts": [
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/directory.readonly",
]
```

`directory.readonly` is the **Admin SDK Directory API** scope — it only exists
for Google Workspace domains with an admin console. A personal `@gmail.com`
account has no directory to read, so Google can **never durably grant this
scope to it**. At the *initial* authorization step Google appears to silently
drop the ungrantable scope from what it actually issues rather than erroring
the whole consent — so the first auth looks like it succeeded. But
`gws-cli`'s refresh logic (`gws/auth/oauth.py::get_credentials`) always
reconstructs `Credentials` with the *current full configured scope list*
(`_get_required_scopes()`, not whatever was actually granted last time) and
passes it to `.refresh()`. Every refresh therefore re-requests
`directory.readonly`, and Google rejects it again — indefinitely, not once.

This is a known issue in the sibling `gws` project too:
[`googleworkspace/cli#119`](https://github.com/googleworkspace/cli/issues/119) —
*"Scope presets should be account-type-aware... admin-only scopes... will
always fail for `@gmail.com` accounts."*

**How to check if this is what you're hitting:**
```bash
cat ~/.config/gws-cli/gws_config.json   # look at "enabled_services" — is "contacts" in the list?
```
(This file is plaintext JSON, not `.enc` — safe to `cat` directly, including
via an agent; the guard hook only blocks `*.enc` credential files.) If
`contacts` is enabled and the account is a personal Gmail address (not
`@yourcompany.com` on a Workspace domain), this is Case B.

**Permanent fix — stop requesting the scope, don't just re-consent.** There's
no per-scope toggle, only per-service, so disabling `contacts` drops both its
scopes (losing `gws-cli`'s Contacts features — not used by any wrapper script
in this skill, so no functional loss here):

```bash
uvx gws-cli@1.3.1 config disable contacts
rm ~/.config/gws-cli/token.json.enc   # only if the next command still fails without it
OAUTHLIB_RELAX_TOKEN_SCOPE=1 uvx gws-cli@1.3.1 gmail labels
```

**You may not even need a new consent screen.** If the existing refresh token
already excluded `directory.readonly` (per the silent-drop behavior above),
disabling `contacts` alone can make the very next `refresh()` call succeed
immediately — no browser, no URL — because the newly reduced request is now a
subset of what was actually granted. Confirmed in practice: after `config
disable contacts`, the next `gmail labels` call refreshed silently with no new
OAuth flow. Don't be alarmed if this happens; it's the expected best case, not
a sign the fix didn't take. Run `calendar list` (or whichever command
originally failed) too before considering it closed, since a single successful
call doesn't confirm every scope path.

**Nothing to change in Google Cloud Console for either case.** The **Data
Access** tab (`console.cloud.google.com/auth/scopes`) is a self-declaration
used only for the verification-submission process — it does not gate what an
unverified Desktop-app client can request via the auth URL directly, and it
does not control which scopes Google will actually grant to a given account
type. It's normal and fine for it to show "No rows to display" in all three
categories (non-sensitive / sensitive / restricted) even though the app is
actively granted sensitive/restricted scopes (Gmail, Docs, etc.) — leave it
empty. Populating it only matters if you intend to submit for Google
verification, which isn't worth it for a single-user personal tool (see the
`invalid_grant` section above for that trade-off). The personal-account
scope limitation in Case B is inherent to the account type, not a Console
setting — there is nothing to flip there to fix it.

**What would trigger Case B again:** re-enabling `contacts`
(`config enable contacts` or `config reset`, which re-enables all services) on
a personal (non-Workspace) account.
