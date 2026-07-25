# Auth Troubleshooting

Four distinct auth failures show up as "it's asking me to log in again." They have
different causes and different fixes — check the error string first, and for
`invalid_scope` specifically, don't theorize from `enabled_services` or account type
alone — check what's actually granted first (see below), then match against Case A/B/C.

## Fastest diagnostic for `invalid_scope`: check what's actually granted

Before picking a case below, go to
[`myaccount.google.com/permissions`](https://myaccount.google.com/permissions), find
this app's entry (named after whatever you called the OAuth client — e.g. "Self-Hosted
Tools"), and expand it. It lists, in plain language, exactly which permissions Google
actually granted — independent of what `enabled_services` says gws-cli is *requesting*.
Compare that list against the six services' scopes in `gws/auth/scopes.py` (`docs`,
`sheets`, `slides`, `drive`, `gmail`, `calendar` — `contacts` too if enabled). Any
requested service whose scope isn't in the granted list will fail `invalid_scope` on
every refresh, forever, regardless of cause — this page is ground truth, reasoning
about *why* a scope might not be granted (Case A vs B vs C below) is secondary to
confirming *that* it isn't.

This page also shows the original grant date, which can be misleading: it does **not**
update when you complete an incremental-authorization re-consent, so a grant that looks
weeks or months old may still be the one currently in effect even after you "re-minted"
the token yesterday — don't assume a recent re-auth changed what's listed here without
checking.

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

## `invalid_scope` — three different causes, check granted permissions first

**Symptom:** even on a Published (In production) project, a refresh attempt fails:

```
[gws-cli] Warning: token refresh failed: ('invalid_scope: Bad Request', {'error': 'invalid_scope', 'error_description': 'Bad Request'})
```

...followed by a fresh OAuth URL. This is a **different failure mode from the
7-day Testing cap above** — don't confuse the two. `invalid_grant` = expired by
policy (Google's own docs list the exhaustive reasons:
`developers.google.com/identity/protocols/oauth2#expiration` — revocation, 6
months unused, password change, the 100-token-per-client cap, admin policy,
time-based access expiry; `invalid_scope` is not among them). `invalid_scope` =
the cached refresh token's scope set no longer matches what the client is
requesting on refresh — a client-side/request-shape problem, not a Google-side
expiration event.

There are three distinct reasons this scope mismatch happens. **Check the
[permissions page](https://myaccount.google.com/permissions) first** (see
above), then match against these — Case A is genuinely a one-off; Case B and
Case C are both structural and will recur on every single refresh until you
address them, no matter how many times you re-consent.

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

**Nothing to change in Google Cloud Console for any of these cases.** The **Data
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

### Case C: a requested service's scope was simply never granted for this account — structural, no account-type restriction involved

**Symptom that distinguishes this from Case B:** the ungranted scope is *not*
an admin-only one — `contacts`/`directory.readonly` may be disabled or absent
from `enabled_services` entirely, and the account type is irrelevant. Any of
the six ordinary service scopes (`docs`, `sheets`, `slides`, `drive`, `gmail`,
`calendar`) can be missing from what was actually granted, for entirely
mundane reasons: you clicked through a granular consent screen and didn't
check every box, a service was added to `enabled_services` after the last time
you completed a full consent flow, or you simply never use that service and it
was never consciously granted in the first place.

**Confirmed on this repo 2026-07-25:** `enabled_services` requested `docs`,
`sheets`, `slides`, `drive`, `gmail`, `calendar`, `convert` (7 services, 6
distinct scopes). The [permissions page](https://myaccount.google.com/permissions)
showed only `gmail` (read/compose/send/labels), `calendar` (full), and `drive`
(full) as actually granted — `docs`/`sheets`/`slides`/`convert` never had a
grant, going back to the original consent on 29 June (the "Access given on"
date does not update on incremental re-consent — see the diagnostic section
above). Every refresh since then re-requested all seven services and failed on
the three that were never granted, **even immediately after a same-day
"successful" re-auth**, because the token that came back from that re-auth
still didn't include them — the OAuth consent screen doesn't error out on a
partial grant, it just silently issues a token covering less than what was
requested. This looks identical to Case A/B from the error string alone; only
the permissions page distinguishes it.

**Permanent fix — request only what's actually granted (or actually needed):**

```bash
cat ~/.config/gws-cli/gws_config.json   # check current enabled_services
```

Edit `enabled_services` directly (plaintext JSON, safe to edit with a normal
text edit — no `gws-cli` invocation needed) down to the services that are (a)
actually used by a wrapper script in `~/bin/agent_scripts/` and (b) confirmed
present on the permissions page. For this skill, that's just `gmail` and
`calendar` — no `docs-*`/`sheets-*`/`slides-*`/`drive-*` wrapper scripts exist,
so those services being ungrantable cost nothing functionally.

**You will not need a new consent screen if you're only removing services** —
same mechanism as Case B: shrinking the request to a subset of what's already
granted lets the very next refresh succeed silently. Confirmed in practice:
after trimming to `gmail` + `calendar`, `gmail-labels` and `calendar-list` both
refreshed with no browser prompt.

**Adding a granted-but-currently-unused service back is also safe without a
new consent flow** — e.g. `drive` was re-added to `enabled_services` here even
though no wrapper script uses it yet, because the permissions page confirmed
it's already granted. Verify via the permissions page before re-adding
anything, don't assume based on what "should" have been granted. Adding back
`docs`/`sheets`/`slides`/`convert` **would** require a fresh consent pass
(and, per this same failure mode, you'd need to explicitly check those
permission boxes and then re-verify the grant landed via the permissions page
before trusting it — don't just assume completing the flow means the scope
was actually granted).

**What would trigger Case C again:** adding any service to `enabled_services`
whose scope isn't already listed on the permissions page, without completing a
fresh consent *and* confirming the grant on the permissions page afterward.
