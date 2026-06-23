# Calendar Operations — Commands at a Glance

All operations use the wrapper scripts in `~/bin/agent_scripts/`. Direct `gws-cli` calls are blocked.

## Prerequisites

Before doing any calendar work, verify auth:

```bash
~/bin/agent_scripts/gmail-labels
```

If auth errors, stop and tell the user.

---

## Base commands

```bash
# List upcoming events (primary calendar, default: 10)
~/bin/agent_scripts/calendar-list
~/bin/agent_scripts/calendar-list --max 50
~/bin/agent_scripts/calendar-list --from 2026-01-15 --to 2026-01-20 --max 50

# Structured JSON output — use this when you need to build an updates.json for batch triage
~/bin/agent_scripts/calendar-list --json --from 2026-01-15 --to 2026-01-20 --max 100

# Get a specific event (truncated description — 2000 chars)
~/bin/agent_scripts/calendar-get <event-id>
# Full description
~/bin/agent_scripts/calendar-get --full <event-id>

# Create a simple event
~/bin/agent_scripts/calendar-create "Summary" 2026-01-15T10:00:00 2026-01-15T11:00:00

# All-day event (start = end = date-only)
~/bin/agent_scripts/calendar-create "Summary" 2026-01-15 2026-01-16 --all-day

# Update a single event — use for 1–4 events only
~/bin/agent_scripts/calendar-update <event-id> \
  --summary "Updated title ✅" \
  --start 2026-01-15T10:00:00 \
  --end 2026-01-15T11:00:00

# Batch update — use for 5+ events (runs concurrently, ~40 s for 70 events vs 400 s sequential)
~/bin/agent_scripts/calendar-batch-update /tmp/calendar-updates.json
```

## Batch triage workflow (5+ events)

**Never write a generator script to produce the JSON.** Use `--json` + Write tool instead:

```bash
# Step 1: get structured JSON for the date range
~/bin/agent_scripts/calendar-list --json --from 2026-04-01 --to 2026-06-21 --max 100
```

Step 2: analyse the JSON output in context. For each event, decide:
- Skip (recurring anchor, already has ✅/❌, or ID ends with `_YYYYMMDD`)
- `"summary"` change only (add `- ` prefix, append `✅`/`❌`)
- Date move only (carry forward)
- Both (summary + date)

Step 3: write `updates.json` directly using the Write tool — pull the `id` from the JSON output (not from the text display, which can truncate). Only include fields that change:

```json
[
  {"id": "full-event-id-from-json", "summary": "- Reflection text"},
  {"id": "full-event-id-from-json", "summary": "Missed task ❌"},
  {"id": "full-event-id-from-json", "start": "2026-06-27", "end": "2026-06-28"},
  {"id": "full-event-id-from-json", "summary": "Done thing ✅", "start": "2026-06-21", "end": "2026-06-22"}
]
```

Step 4: run the batch update:
```bash
~/bin/agent_scripts/calendar-batch-update /tmp/calendar-updates.json
```

The `id` field in the JSON output is always the full untruncated event ID — copy it directly. Recurring instances have IDs ending in `_YYYYMMDD`; skip those unless specifically targeting an instance.

## Applying convention changes

### Mark a task complete (✅)

```bash
# Get current event info first (to preserve description, location, etc.)
~/bin/agent_scripts/calendar-get --full <event-id>

# Then update with ✅ appended to summary
~/bin/agent_scripts/calendar-update <event-id> \
  --summary "Original title ✅" \
  --start YYYY-MM-DD  # only if completed on a different day
```

### Carry a task forward

```bash
# Move start/end to the next available day
~/bin/agent_scripts/calendar-update <event-id> \
  --start 2026-01-17 \
  --end 2026-01-18
```

### Mark a date-bound event missed (❌)

```bash
~/bin/agent_scripts/calendar-update <event-id> \
  --summary "Original title ❌"
```

### Add note prefix to a reflection event

```bash
~/bin/agent_scripts/calendar-update <event-id> \
  --summary "- Original reflection text"
```

## Output format

`calendar-list` formats events as:
```
DATETIME | SUMMARY | LOCATION | EVENT_ID
```

When parsing the list, the `EVENT_ID` is the last field — it's a long alphanumeric string. The recurring instance IDs have a `_YYYYMMDD` suffix (e.g. `...9pcg_20260621`). Always use the full event ID when passing to `calendar-update`.

## What is NOT available

- **Delete events** — blocked by guard hook. Tell the user if they ask.
- **Modify recurring event masters** — never do this. Only update specific instances.
- **Send notifications to attendees** — no `send_updates` flag in the wrapper.