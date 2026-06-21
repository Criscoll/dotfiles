# Gmail — Allowed Command Surface

All Gmail operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.0 gmail ...` directly.

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
get-vacation, get-signature, filters, get-filter, history): if you need one of these,
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
```

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

Label operations (add-labels, remove-labels, mark-read, mark-unread, modify-thread-labels,
batch-modify, create-label) have no wrappers yet. Ask the user to add wrapper scripts
if you need to organize email — do not call gws-cli directly.

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
