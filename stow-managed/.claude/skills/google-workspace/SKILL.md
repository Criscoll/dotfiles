---
name: google-workspace
description: >-
  Read Gmail (list/search/read/label-move) and Calendar (list/get/create/update)
  via gws-cli. Enforced at the harness layer by a deny-by-default allow-list hook —
  send, delete, and destructive Calendar operations are structurally blocked and
  cannot be invoked regardless of how the command is phrased.
  Trigger phrases: "check email", "search gmail", "list emails", "read email",
  "archive email", "label email", "mark as read", "list calendar events",
  "create event", "update event", "google calendar", "gmail", "workspace".
disable-model-invocation: false
---

You are running the google-workspace skill. Drive `gws-cli` for Gmail and Calendar
work. **Send, delete, and destructive calendar operations are structurally unavailable
— the harness hook blocks them even if attempted.**

Always pin the exact version: `uvx gws-cli@1.3.0 <service> <subcommand> [flags]`

## Verify auth first

Before doing any real work, verify gws-cli is authenticated:

```bash
uvx gws-cli@1.3.0 gmail labels
```

If this errors with an auth/token error, point the user to the per-machine setup
section below rather than continuing.

For list and read operations, always use the wrapper scripts in `~/bin/agent_scripts/`
rather than raw `gws-cli`. The wrappers strip the security-warning JSON overhead and
truncate long bodies, cutting token usage by an order of magnitude.

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

Verify scopes were granted:
```bash
uvx gws-cli@1.3.0 account info
uvx gws-cli@1.3.0 gmail labels
uvx gws-cli@1.3.0 calendar list
```

The token is stored encrypted under `~/.config/gws-cli/`. It is never committed to
this repo and must be recreated on each new machine.
