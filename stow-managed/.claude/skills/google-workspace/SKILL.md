---
name: google-workspace
description: >-
  Read Gmail (list/search/read/label-move), download and view email attachments
  (PDFs, etc.), manage Calendar (list/get/create/update), and search/download
  Google Drive files (list/search/get/download/export) via gws-cli wrapper
  scripts in `~/bin/agent_scripts/`.
  Enforced at the harness layer by a deny-by-default allow-list hook —
  send, delete, and destructive Calendar/Drive operations are structurally blocked
  and cannot be invoked regardless of how the command is phrased.
  Trigger phrases: "check email", "search gmail", "list emails", "read email",
  "archive email", "label email", "mark as read", "list calendar events",
  "create event", "update event", "google calendar", "gmail", "workspace",
  "attachment", "download attachment", "email pdf", "has attachment",
  "search drive", "find file", "download file", "google drive", "drive file".
disable-model-invocation: false
---

You are running the google-workspace skill. Drive `gws-cli` for Gmail, Calendar, and
Drive work. **Send, delete, and destructive calendar/Drive operations are structurally
unavailable — the harness hook blocks them even if attempted.**

Always pin the exact version: `uvx gws-cli@1.3.1 <service> <subcommand> [flags]`

## Verify auth first

Before doing any real work, verify gws-cli is authenticated:

```bash
~/bin/agent_scripts/gmail-labels
```

If this errors with an auth/token error, point the user to the per-machine setup
section below rather than continuing.

For Gmail list, search, and read operations, Calendar list, get, create, and update
operations, and Drive list, search, get, download, and export operations, always use
the wrapper scripts in `~/bin/agent_scripts/` rather than raw `gws-cli`. The wrappers
unwrap the outer JSON envelope, truncate long bodies, and format output as compact
one-line-per-item listings, cutting token usage by an order of magnitude.

## Load the reference files

Read all three reference files before doing any Gmail, Calendar, or Drive work:

```bash
cat "${CLAUDE_SKILL_DIR}/gmail.md"
cat "${CLAUDE_SKILL_DIR}/calendar.md"
cat "${CLAUDE_SKILL_DIR}/drive.md"
```

## Load reference files when relevant

Read using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/auth-troubleshooting.md** — load when: `gmail-labels` or any gws-cli
  call errors with an auth/token/scope problem — covers the `invalid_grant`
  (7-day Testing-mode cap) failure mode and three distinct `invalid_scope`
  causes (incremental-authorization mismatch, admin-only scope on a personal
  account, a requested scope simply never granted), how to tell them apart via
  the account's actual granted-permissions page, and why the fix for each
  differs.

## What is NOT available (hook-enforced)

The following are denied by the PreToolUse allow-list hook and will be blocked
even if you attempt them. Do not suggest or attempt these:

**Gmail:** `send`, `reply`, `send-with-attachment`, `create-draft`, `update-draft`,
`send-draft`, `delete-draft`, `delete`, `trash-thread`, `untrash`, `untrash-thread`,
`delete-thread`, `delete-label`, `update-label`, `set-vacation`, `set-signature`,
`create-filter`, `delete-filter`

**Calendar:** `delete`, `clear-calendar`, `delete-calendar`, `create-calendar`,
`add-acl`, `remove-acl`, `update-acl`, `subscribe`, `unsubscribe`, `clear-reminders`

**Drive:** `upload`, `delete`, `share`, `unshare`, `move`, `copy`, `rename`, `update`,
`create-folder`, `trash`, `untrash`, `empty-trash`, `add-comment`, `update-comment`,
`delete-comment`, `list-comments`, `get-comment`, `add-permission`, `update-permission`,
`remove-permission`, `list-permissions`, `list-revisions`, `get-revision`,
`delete-revision`, `transfer-ownership`, `list-changes`, `watch-changes`

This list is not hook-structurally-enforced the way `.enc` file access is — it's
enforced by which wrapper scripts exist. Do not attempt these via raw `gws-cli` even
if you believe a legitimate use case exists; ask the user to add a wrapper instead.

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

## If auth errors after setup

Don't guess at a fix — the error string tells you which of two distinct failure
modes you're in (`invalid_grant` vs `invalid_scope`), and they have different
causes and fixes. Load `references/auth-troubleshooting.md` and match the
symptom before acting.
