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

Always pin the exact version: `uvx gws-cli@1.3.0 <service> <subcommand> [flags]`

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

Authenticate gws-cli for Gmail + Calendar (interactive OAuth, browser will open):
```bash
uvx gws-cli@1.3.0 auth login
uvx gws-cli@1.3.0 account add-service gmail
uvx gws-cli@1.3.0 account add-service calendar
```

Disable gws-cli's built-in semantic security screening:
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
decides), making probabilistic content scanning unnecessary.

**JSON format note:** With `security_enabled: false`, gws-cli changes its output format —
`messages` goes from `{"data": "[...]"}` (a dict with a "data" key) to `"[...]"` (a plain
JSON string). The wrapper scripts handle both formats via an `extract()` helper; raw
`gws-cli` consumers must do the same.

Verify scopes were granted:
```bash
uvx gws-cli@1.3.0 account info
uvx gws-cli@1.3.0 gmail labels
uvx gws-cli@1.3.0 calendar list
```

The token is stored encrypted under `~/.config/gws-cli/`. It is never committed to
this repo and must be recreated on each new machine.
