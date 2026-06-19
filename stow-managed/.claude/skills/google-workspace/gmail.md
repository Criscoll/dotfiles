# Gmail — Allowed Command Surface

All commands use `uvx gws-cli@1.3.0 gmail <subcommand> [flags]`.

The hook allows only the subcommands listed here. Anything else is denied.

## Reading

```bash
# List inbox (default: recent 20)
uvx gws-cli@1.3.0 gmail list
uvx gws-cli@1.3.0 gmail list --max 50

# Read a message (by message ID from list output)
uvx gws-cli@1.3.0 gmail read <message-id>

# Search
uvx gws-cli@1.3.0 gmail search "from:someone@example.com subject:invoice"
uvx gws-cli@1.3.0 gmail search "is:unread after:2024/01/01"

# Labels
uvx gws-cli@1.3.0 gmail labels
uvx gws-cli@1.3.0 gmail get-label <label-id>

# Drafts (read-only)
uvx gws-cli@1.3.0 gmail drafts
uvx gws-cli@1.3.0 gmail get-draft <draft-id>

# Threads
uvx gws-cli@1.3.0 gmail threads
uvx gws-cli@1.3.0 gmail get-thread <thread-id>

# Attachments
uvx gws-cli@1.3.0 gmail list-attachments <message-id>
uvx gws-cli@1.3.0 gmail download-attachment <message-id> <attachment-id>

# Settings (read-only)
uvx gws-cli@1.3.0 gmail get-vacation
uvx gws-cli@1.3.0 gmail get-signature
uvx gws-cli@1.3.0 gmail filters
uvx gws-cli@1.3.0 gmail get-filter <filter-id>

# History
uvx gws-cli@1.3.0 gmail history --start-history-id <id>
```

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
uvx gws-cli@1.3.0 gmail search "subject:foo is:unread"
# 2. Remove INBOX label (= archive)
uvx gws-cli@1.3.0 gmail remove-labels <message-id> INBOX
```
