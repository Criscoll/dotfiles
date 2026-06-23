# Calendar — Allowed Command Surface

All calendar operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.0 calendar ...` directly.

Default calendar is the authenticated account's primary calendar.

## Reading

```bash
# List all accessible calendars (names + IDs)
~/bin/agent_scripts/calendar-calendars
~/bin/agent_scripts/calendar-calendars --json
```

```bash
# List upcoming events (primary calendar, default: 10 most recent)
~/bin/agent_scripts/calendar-list
~/bin/agent_scripts/calendar-list --max 50
~/bin/agent_scripts/calendar-list --calendar <calendar-id> --max 50

# Get a specific event — truncates description to 2000 chars
~/bin/agent_scripts/calendar-get <event-id>
# Full description (no truncation)
~/bin/agent_scripts/calendar-get --full <event-id>
# On a specific calendar
~/bin/agent_scripts/calendar-get <event-id> --calendar <calendar-id>

# Time-range listing
~/bin/agent_scripts/calendar-list --from 2024-01-15T09:00:00 --to 2024-01-15T17:00:00

# Free-text search
~/bin/agent_scripts/calendar-list --query "team lunch"
```

**Operations with no wrapper yet** (instances, attendees, freebusy, colors, list-acl, get-reminders, get-default-reminders): if you need one of these, state what you need and confirm no existing wrapper covers it, then ask the user to add a new wrapper script.

## Creating events

```bash
# Create a single event (summary, start, end are positional)
~/bin/agent_scripts/calendar-create "Team sync" 2024-01-15T10:00:00 2024-01-15T11:00:00

# With timezone offset
~/bin/agent_scripts/calendar-create "Team sync" 2024-01-15T10:00:00+01:00 2024-01-15T11:00:00+01:00

# All-day event
~/bin/agent_scripts/calendar-create "Conference" 2024-01-15 2024-01-16 --all-day

# With location and description
~/bin/agent_scripts/calendar-create "Lunch" 2024-01-15T12:00:00 2024-01-15T13:00:00 \
  --location "Restaurant XYZ" \
  --description "Monthly team lunch"

# On a specific calendar
~/bin/agent_scripts/calendar-create "Event" 2024-01-15T10:00:00 2024-01-15T11:00:00 \
  --calendar <calendar-id>

# With attendees (comma-separated emails)
~/bin/agent_scripts/calendar-create "Meeting" 2024-01-15T10:00:00 2024-01-15T11:00:00 \
  --attendees "alice@example.com,bob@example.com"

# Quick add, recurring events: not yet wrapped (use raw gws-cli is blocked)
```

## Updating events

```bash
# Update title, time, or other fields
~/bin/agent_scripts/calendar-update <event-id> \
  --summary "Updated title" \
  --start 2024-01-15T11:00:00 \
  --end 2024-01-15T12:00:00

# Update description or location
~/bin/agent_scripts/calendar-update <event-id> \
  --description "New notes" \
  --location "New place"

# Move event to a different calendar — NOT wrapped (use raw gws-cli is blocked)
```

## Batch updating events (use for 5+ events)

Single `calendar-update` calls take ~5–6 s each (uvx startup + API). For bulk triage or carry-forward work, use the batch wrapper instead — it runs all updates concurrently and completes 70 events in ~40 s instead of ~400 s.

```bash
# Write a JSON file of updates first, then run the batch wrapper
cat > /tmp/calendar-updates.json << 'EOF'
[
  {"id": "event-id-1", "summary": "- Reflection text"},
  {"id": "event-id-2", "summary": "Task ❌"},
  {"id": "event-id-3", "summary": "Carried forward task", "start": "2026-06-28", "end": "2026-06-29"}
]
EOF

~/bin/agent_scripts/calendar-batch-update /tmp/calendar-updates.json

# All events on the same non-primary calendar
~/bin/agent_scripts/calendar-batch-update /tmp/calendar-updates.json \
  --calendar "8ea572bf0778ac8c77c8417ee697bc7b94f70e1d7763984dfe64e4e5fddf02fe@group.calendar.google.com"

# With a custom concurrency limit (default: 10)
~/bin/agent_scripts/calendar-batch-update /tmp/calendar-updates.json --concurrency 5
```

**Supported fields per update object:**
- `id` — (required) event ID
- `calendar` — (optional) calendar ID; overrides `--calendar` for this event
- `summary` — new title
- `start` — new start (ISO 8601, date or datetime)
- `end` — new end (ISO 8601, date or datetime)
- `description` — new description
- `location` — new location

Only include fields that need to change; omitted fields are left as-is. Events in different calendars can be batched together by setting `calendar` per event:

```json
[
  {"id": "event-in-primary", "summary": "Updated ✅"},
  {"id": "event-in-chores", "calendar": "<chores-cal-id>", "summary": "Updated ✅"},
  {"id": "event-in-exercise", "calendar": "<exercise-cal-id>", "summary": "Updated ✅"}
]
```

**Rule:** Use `calendar-batch-update` whenever you have 5 or more updates to make. Use `calendar-update` for 1–4 individual updates where ad-hoc is cleaner.

## Notes

- **Never send notifications to attendees** unless the user explicitly requests it. There's no `send_updates` flag exposed by the wrapper — avoid operations that notify attendees unless the user asks for it.
- For calendar-triage style annotation, use `update` to append ✅ or ❌ to the event summary only. Never modify recurring event masters; always work with the specific instance's event ID.
- Time formats: ISO 8601 (`2024-01-15T10:00:00`) for timed events; `2024-01-15` (date-only) for all-day events. Timed events should include timezone offset (e.g. `+01:00`) to avoid "Missing time zone definition" errors.
- `calendar-list` output format: `start_datetime | summary | location | event_id` (one line per event). All-day events show just the date; timed events show `start -- end`.
- `calendar-list --json` prints raw JSON for all events (useful for programmatic access).