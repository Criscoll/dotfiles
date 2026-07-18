---
name: google-workspace
description: >-
  Read Gmail (list/search/read/label-move), download and view email attachments
  (PDFs, etc.), and manage Calendar (list/get/create/update) via gws-cli wrapper
  scripts in `~/bin/agent_scripts/`.
  Enforced at the harness layer by a deny-by-default allow-list hook —
  send, delete, and destructive Calendar operations are structurally blocked and
  cannot be invoked regardless of how the command is phrased.
  Trigger phrases: "check email", "search gmail", "list emails", "read email",
  "archive email", "label email", "mark as read", "list calendar events",
  "create event", "update event", "google calendar", "gmail", "workspace",
  "attachment", "download attachment", "email pdf", "has attachment".
disable-model-invocation: false
---

You are running the google-workspace skill. Drive `gws-cli` for Gmail and Calendar
work. **Send, delete, and destructive calendar operations are structurally unavailable
— the harness hook blocks them even if attempted.**

Always pin the exact version: `uvx gws-cli@1.3.1 <service> <subcommand> [flags]`

## Verify auth first

Before doing any real work, verify gws-cli is authenticated:

```bash
~/bin/agent_scripts/gmail-labels
```

If this errors with an auth/token error, point the user to the per-machine setup
section below rather than continuing.

For Gmail list, search, and read operations and Calendar list, get, create, and update
operations, always use the wrapper scripts in `~/bin/agent_scripts/` rather than raw
`gws-cli`. The wrappers unwrap the outer JSON envelope, truncate long bodies, and format
output as compact one-line-per-item listings, cutting token usage by an order of magnitude.

## Load the reference files

Read both reference files before doing any Gmail or Calendar work:

```bash
cat "${CLAUDE_SKILL_DIR}/gmail.md"
cat "${CLAUDE_SKILL_DIR}/calendar.md"
```

## What is NOT available (hook-enforced)

The following are denied by the PreToolUse allow-list hook and will be blocked
even if you attempt them. Do not suggest or attempt these:

**Gmail:** `send`, `reply`, `send-with-attachment`, `create-draft`, `update-draft`,
`send-draft`, `delete-draft`, `delete`, `trash-thread`, `untrash`, `untrash-thread`,
`delete-thread`, `delete-label`, `update-label`, `set-vacation`, `set-signature`,
`create-filter`, `delete-filter`

**Calendar:** `delete`, `clear-calendar`, `delete-calendar`, `create-calendar`,
`add-acl`, `remove-acl`, `update-acl`, `subscribe`, `unsubscribe`, `clear-reminders`

---

## Per-machine setup (run once on each new machine)

Install `uv` if not present:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 1. Get a plaintext OAuth client credential

You need a `client_secret.json` (Desktop app type) from Google Cloud Console
(APIs & Services > Credentials > Create OAuth client ID > Desktop app), or a
plaintext copy saved from a prior setup.

**Do not copy `client_secret.json.enc` / `token.json.enc` from another machine
— it will not decrypt.** gws-cli derives its Fernet encryption key at runtime from
machine ID + username + a random salt (`gws/config.py::get_encryption_key`,
`gws/crypto.py::derive_key`). A `.enc` file encrypted on one machine is cryptographically
tied to that machine and cannot be imported elsewhere. You always need to start from
the plaintext credential file.

Import it (this encrypts it for storage on *this* machine):
```bash
uvx gws-cli@1.3.1 auth import-credentials /path/to/client_secret.json
```

### 2. Trigger the OAuth flow directly — not through a wrapper script

There is no `auth login` or `account add-service` command in gws-cli 1.3.x (older
docs/muscle-memory may suggest otherwise — those subcommands don't exist here). Auth is
lazy: it fires automatically the first time any Gmail/Calendar command runs and no valid
token is cached. Trigger it with a direct call, **not** via `~/bin/agent_scripts/*` —
the wrapper scripts capture stdout/stderr, so the authorization URL never reaches your
terminal and the process just looks silently stuck:

```bash
OAUTHLIB_RELAX_TOKEN_SCOPE=1 uvx gws-cli@1.3.1 gmail labels
```

Set `OAUTHLIB_RELAX_TOKEN_SCOPE=1`: your OAuth client's configured "Data access" scopes
in Cloud Console may be narrower than what gws-cli requests (e.g. only `gmail.modify` +
`calendar` enabled, not the full Docs/Sheets/Slides/Drive/Contacts set) — that's expected
and fine. But `oauthlib` treats any scope narrowing as a fatal error unless told to relax,
and crashes the token exchange right after you've already approved consent in the browser.
Without this flag, the browser shows "Authorization successful" but the terminal raises
`Scope has changed from ... to ...` and no token gets saved — a confusing false negative.

**On a headless/remote machine (VPS, no local browser):** the flow starts a local
callback server on `http://127.0.0.1:8081/` and prints an authorization URL, then waits.
A different machine's browser can't reach that callback server directly. Tunnel it:

1. Leave the terminal running the auth command open — it's waiting on port 8081.
2. From the machine with a browser, in a separate terminal:
   `ssh -L 8081:localhost:8081 <user>@<remote-host>` (leave this open too; nothing needs
   to run inside it).
3. Copy the printed URL and open it in that browser, approve access.
4. The tunnel forwards the callback to the waiting process, which completes and saves
   the token.

Each invocation mints a fresh, single-use URL/state — a URL from a previous attempt
won't work for a new process, so don't try to reuse one after a failure.

### 3. Disable the built-in semantic security screening

```bash
python3 -c "
import json, pathlib
p = pathlib.Path.home() / '.config/gws-cli/gws_config.json'
c = json.loads(p.read_text())
c['security_enabled'] = False
p.write_text(json.dumps(c, indent=2))
"
```

Why: gws-cli's `security_enabled` runs an ONNX fastembed model from `/tmp/fastembed_cache/`
to scan email content for prompt injection. That path is wiped on reboot, causing
`ONNXRuntimeError: NO_SUCHFILE` crashes on every cold start. The screening is also
redundant — `gws-guard.sh` already provides structural enforcement at the action layer
(destructive subcommands are blocked before they execute regardless of what the LLM
decides), making probabilistic content scanning unnecessary. It also changes the response
shape: some wrapper unwrap logic (e.g. `calendar-calendars`) doesn't handle the
screening-wrapped payload (`{"data": "[...]", "trust_level": ..., "warning": ...}`) and
fails with "Unexpected calendars format" if this is left enabled.

**JSON format note:** With `security_enabled: false`, gws-cli's output changes — a field
like `messages` or `calendars` goes from `{"data": "[...]", ...}` (a dict wrapping a JSON
string, plus screening metadata) to `"[...]"` (a plain JSON string) directly. The wrapper
scripts handle both formats; raw `gws-cli` consumers must do the same.

### 4. Verify

```bash
uvx gws-cli@1.3.1 gmail labels
uvx gws-cli@1.3.1 calendar list
```

The token is stored encrypted under `~/.config/gws-cli/`. It is never committed to
this repo and must be recreated on each new machine.

---

## Fixing recurring re-auth every ~7 days

**Symptom:** auth from the steps above works, but expires and demands a fresh
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
