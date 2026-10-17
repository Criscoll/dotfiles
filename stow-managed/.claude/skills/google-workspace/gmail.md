# Gmail — Allowed Command Surface

All Gmail operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.1 gmail ...` directly.

## Reading

For all reading operations, use the wrapper scripts. They strip the JSON security-warning wrapper (~2.7KB per call) and truncate long bodies, cutting token usage by an order of magnitude.

```bash
# List inbox (default: recent 20)
~/bin/agent_scripts/gmail-list
~/bin/agent_scripts/gmail-list --max 50

# Note: gmail-list does NOT show a labels column — the Gmail list API returns no label data.
# To see labels for a message, use gmail-get-metadata.

# Get headers only (From, To, Date, Labels, Subject) — no body
~/bin/agent_scripts/gmail-get-metadata <message-id>

# Read a message — truncates body to 2000 chars
~/bin/agent_scripts/gmail-read <message-id>
# Full body (no truncation)
~/bin/agent_scripts/gmail-read --full <message-id>
# WARNING: gmail-read is API-backed — takes 30–60 seconds per call.
# Never pipe with | head -N (no output is produced until the API call completes,
# so head has nothing to truncate). Always use a 60-second timeout or higher.

# Search
~/bin/agent_scripts/gmail-search "from:someone@example.com subject:invoice"
~/bin/agent_scripts/gmail-search "is:unread after:2024/01/01" --max 50

# Labels (list all labels/IDs)
~/bin/agent_scripts/gmail-labels
~/bin/agent_scripts/gmail-labels --all           # include system labels
~/bin/agent_scripts/gmail-labels --filter inbox  # filter by name substring
```

**Operations with no wrapper yet** (get-label, drafts, get-draft, threads, get-thread,
get-vacation, get-signature, history): if you need one of these,
state what you need and ask the user to add a new wrapper script.

**`get-message` is NOT a valid gws-cli subcommand — do not attempt it.**

## gmail-get-metadata — output format

```
From:    sender@example.com
To:      you@example.com
Date:    Mon, 16 Jun 2026 14:23:01 +0000
Labels:  INBOX, CATEGORY_UPDATES, MyLabel
Subject: Your invoice is ready
```

Use this instead of `gmail-read` when you only need metadata (e.g. to check what labels
a message has). It calls the same `gws-cli gmail read` API but skips body rendering,
so it's just as slow (30–60 s) but produces far fewer tokens.

## Gmail search syntax

### Boolean operators

```bash
# OR grouping — one API call instead of many
~/bin/agent_scripts/gmail-search "{recruiter recruitment headhunter} after:2026/01/01" --max 100

# Negation — exclude terms or senders
~/bin/agent_scripts/gmail-search "recruiter -from:jobs-listings@linkedin.com"

# Combine: multi-keyword OR with exclusions
~/bin/agent_scripts/gmail-search '{"recruiter" "recruitment" "talent acquisition"} after:2026/01/01 -from:jobs-listings@linkedin.com -from:messages-noreply@linkedin.com -from:invitations@linkedin.com' --max 100
```

Key operators:
| Syntax | Meaning |
|---|---|
| `{a b c}` | OR — matches any of a, b, c (one API call) |
| `-term` | NOT — exclude messages containing term |
| `-from:x` | exclude messages from sender x |
| `"phrase"` | exact phrase match |
| `after:YYYY/MM/DD` | date filter |
| `category:promotions` | Gmail category |

### Comprehensive trawl pattern

When surveying a topic across many possible keywords, prefer one `{}` query over multiple searches. Avoids duplicates; uses one API call.

```bash
# Recruiter survey — all keywords + exclude LinkedIn auto-noise
~/bin/agent_scripts/gmail-search '{"recruiter" "recruitment" "headhunter" "talent acquisition" "job opportunity" "new opportunity"} after:2026/01/01 -from:jobs-listings@linkedin.com -from:messages-noreply@linkedin.com -from:invitations@linkedin.com' --max 100
```

## Attachments

### Detect: read an email — attachments shown automatically
```bash
~/bin/agent_scripts/gmail-read <message-id>
# Prints "Attachments (N):" section if present, with filename/type/size/attachment_id
```

### List (when you have a message-id but not yet the full read output)
```bash
~/bin/agent_scripts/gmail-list-attachments <message-id>
# One line per attachment: attachment_id | filename | mime_type | size_kb
```
Note: if you have already run `gmail-read <message-id>`, the output already shows all attachment IDs. Only use `gmail-list-attachments` when you need attachment IDs without reading the email body.

### Download
```bash
~/bin/agent_scripts/gmail-download-attachment <message-id> <attachment-id> <filename>
# Saves to ~/Downloads/gmail-attachments/<filename>, prints the saved path to stdout
# Optional: --out-dir <dir> to override the destination directory

# Example
~/bin/agent_scripts/gmail-download-attachment 18f3a9c2d4e5b601 'ANGjdJ8w…long-opaque-token…' referral.pdf
```

Argument pitfalls (a wrong guess costs a failed API round-trip):
- Order is `<message-id> <attachment-id> <filename>`. `<filename>` is the name you
  want on disk (take it from the listing), never an ID. Swapping it with the
  attachment ID fails with `Gmail API error: Invalid attachment token` (verified
  2026-10-17).
- Attachment IDs are long opaque tokens — several hundred chars (426 observed), may
  contain `-` and `_`. Copy the whole ID verbatim and wrap it in single quotes; a
  truncated ID fails with the same token error (verified). In `gmail-read` output it
  sits inside `(attachment_id: <id>)` — do not include the closing `)`.
- One attachment per call; there is no plural/batch wrapper. For several, run
  `gmail-list-attachments <message-id>` (IDs are the first column) and loop.

### View a PDF after download
```bash
# Use the /pdf-parse skill on the returned path
```

### Find emails that have attachments (no per-message cost)
```bash
~/bin/agent_scripts/gmail-search "has:attachment"
~/bin/agent_scripts/gmail-search "has:attachment subject:insurance"
```

Note: `gmail-list` and `gmail-search` do **not** show attachment columns — the list API returns no attachment data. Use `has:attachment` as a search filter instead.

## Moving / Organizing

```bash
# Create a label (slash creates hierarchy). Output: <label-id> | <name>
~/bin/agent_scripts/gmail-create-label "Receipts/2026"
~/bin/agent_scripts/gmail-create-label "Quiet" --visibility labelHide

# Update a label (rename / colors / visibility). Needs the label ID from gmail-labels.
~/bin/agent_scripts/gmail-update-label Label_12345 --name "Receipts/2027"
~/bin/agent_scripts/gmail-update-label Label_12345 --text-color "#ffffff" --background-color "#039be5"

# List filters. Output: <filter-id> | criteria | action
~/bin/agent_scripts/gmail-filters

# Inspect one filter
~/bin/agent_scripts/gmail-get-filter <filter-id>

# Create a filter — needs >= 1 criterion AND >= 1 action
~/bin/agent_scripts/gmail-create-filter --from "newsletter@example.com" --remove-labels INBOX --add-labels Label_12345
~/bin/agent_scripts/gmail-create-filter --query "invoice" --has-attachment --never-spam --star
# (delete-filter has NO wrapper — filters are permanent for the agent; only create real ones)

> ⚠️ **`gmail-create-filter` is currently blocked by an OAuth scope gap** (verified
> 2026-09-28): the Gmail filters-create API requires the `gmail.settings.basic`
> scope, but gws-cli 1.3.1's gmail scope map requests only `gmail.modify` — it
> never asks for the setting scope, so no re-auth or consent can grant it. The
> call fails with `Gmail API error: Request had insufficient authentication
> scopes.` `gmail-filters` (list) and `gmail-get-filter` DO work under the current
> grant — only creation is blocked. Do not retry create-filter or suggest
> re-authenticating; the fix must land upstream in gws-cli's scope map
> (`gws/auth/scopes.py`). Until then, ask the user to create filters in the
> Gmail UI (Settings → Filters), then the agent can list/inspect them.

# Backfill: apply label actions to EXISTING messages matching a query.
# Gmail has no native "run filter on inbox" — this composite is search + batch-modify.
~/bin/agent_scripts/gmail-backfill "from:newsletter@example.com" --add-labels Label_12345 --dry-run
~/bin/agent_scripts/gmail-backfill "from:newsletter@example.com" --add-labels Label_12345 --max 200
~/bin/agent_scripts/gmail-backfill "from:boss older_than:1y" --remove-labels INBOX   # archive in bulk
# --dry-run prints the match count and would-be actions without modifying anything.
# Always dry-run first; confirm with the user before a real run on a large match set.
# Chunks batch-modify at 100 IDs per API call automatically.
```

Per-message `add-labels`/`remove-labels` and a standalone `batch-modify` wrapper do not
exist — use `gmail-backfill` for bulk label application. `delete-label` and `delete-filter`
have no wrappers (destructive; blocked by absence).

## Common label IDs

| Label     | ID         |
|-----------|------------|
| Inbox     | `INBOX`    |
| Starred   | `STARRED`  |
| Important | `IMPORTANT`|
| Sent      | `SENT`     |
| Spam      | `SPAM`     |
| Unread    | `UNREAD`   |

Custom labels have IDs like `Label_12345` — use `~/bin/agent_scripts/gmail-labels` to list them.
