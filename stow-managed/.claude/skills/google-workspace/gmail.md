# Gmail — Allowed Command Surface

All commands use `uvx gws-cli@1.3.0 gmail <subcommand> [flags]`.

The hook allows only the subcommands listed here. Anything else is denied.

## Reading

For list, search, and read, always use the wrapper scripts rather than raw gws-cli. The wrappers strip the JSON security-warning wrapper (~2.7KB per call) and truncate long bodies, cutting token usage by an order of magnitude.

```bash
# List inbox (default: recent 20) — via token-efficient wrapper
~/bin/agent_scripts/gmail-list
~/bin/agent_scripts/gmail-list --max 50

# Read a message — via token-efficient wrapper (truncates body to 2000 chars)
~/bin/agent_scripts/gmail-read <message-id>
# Full body (no truncation)
~/bin/agent_scripts/gmail-read --full <message-id>
# WARNING: gmail-read is API-backed — takes 30–60 seconds per call.
# Never pipe with | head -N (no output is produced until the API call completes,
# so head has nothing to truncate). Always use a 60-second timeout or higher.

# Search — via token-efficient wrapper
~/bin/agent_scripts/gmail-search "from:someone@example.com subject:invoice"
~/bin/agent_scripts/gmail-search "is:unread after:2024/01/01" --max 50

# Labels
uvx gws-cli@1.3.0 gmail labels
uvx gws-cli@1.3.0 gmail get-label <label-id>

# Drafts (read-only)
uvx gws-cli@1.3.0 gmail drafts
uvx gws-cli@1.3.0 gmail get-draft <draft-id>

# Threads
uvx gws-cli@1.3.0 gmail threads
uvx gws-cli@1.3.0 gmail get-thread <thread-id>

# Attachments — use wrapper scripts (see Attachments section below)
# ~/bin/agent_scripts/gmail-list-attachments <message-id>
# ~/bin/agent_scripts/gmail-download-attachment <message-id> <attachment-id> <filename>

# Settings (read-only)
uvx gws-cli@1.3.0 gmail get-vacation
uvx gws-cli@1.3.0 gmail get-signature
uvx gws-cli@1.3.0 gmail filters
uvx gws-cli@1.3.0 gmail get-filter <filter-id>

# History
uvx gws-cli@1.3.0 gmail history --start-history-id <id>
```

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

```bash
# Apply labels to a message
uvx gws-cli@1.3.0 gmail add-labels <message-id> INBOX STARRED

# Remove labels (archive = remove INBOX label)
uvx gws-cli@1.3.0 gmail remove-labels <message-id> INBOX

# Modify labels on a thread
uvx gws-cli@1.3.0 gmail modify-thread-labels <thread-id> --add LABEL_ID --remove INBOX

# Batch label modification across multiple messages
uvx gws-cli@1.3.0 gmail batch-modify --add LABEL_ID <msg-id1> <msg-id2>

# Mark read / unread
uvx gws-cli@1.3.0 gmail mark-read <message-id>
uvx gws-cli@1.3.0 gmail mark-unread <message-id>

# Create a label
uvx gws-cli@1.3.0 gmail create-label "My Label"
```

## Common label IDs

| Label     | ID         |
|-----------|------------|
| Inbox     | `INBOX`    |
| Starred   | `STARRED`  |
| Important | `IMPORTANT`|
| Sent      | `SENT`     |
| Spam      | `SPAM`     |
| Unread    | `UNREAD`   |

Custom labels have IDs like `Label_12345` — use `gmail labels` to list them.

## Workflow: archive a message

```bash
# 1. Find the message
~/bin/agent_scripts/gmail-search "subject:foo is:unread"
# 2. Remove INBOX label (= archive)
uvx gws-cli@1.3.0 gmail remove-labels <message-id> INBOX
```
