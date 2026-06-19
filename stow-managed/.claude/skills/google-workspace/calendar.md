# Calendar — Allowed Command Surface

All commands use `uvx gws-cli@1.3.0 calendar <subcommand> [flags]`.

The hook allows only the subcommands listed here. Anything else is denied.
Default calendar is the authenticated account's primary calendar.

## Reading

```bash
# List calendars in the account
uvx gws-cli@1.3.0 calendar calendars

# List upcoming events (primary calendar)
uvx gws-cli@1.3.0 calendar list
uvx gws-cli@1.3.0 calendar list --calendar <calendar-id> --max 50

# Get a specific event
uvx gws-cli@1.3.0 calendar get <event-id>
uvx gws-cli@1.3.0 calendar get <event-id> --calendar <calendar-id>

# Recurring event instances
uvx gws-cli@1.3.0 calendar instances <recurring-event-id>

# Attendees of an event
uvx gws-cli@1.3.0 calendar attendees <event-id>

# Free/busy query
uvx gws-cli@1.3.0 calendar freebusy --time-min 2024-01-15T09:00:00Z --time-max 2024-01-15T17:00:00Z

# Colors available for events
uvx gws-cli@1.3.0 calendar colors

# ACL (read-only — list who has access)
uvx gws-cli@1.3.0 calendar list-acl --calendar <calendar-id>

# Reminders
uvx gws-cli@1.3.0 calendar get-reminders <event-id>
uvx gws-cli@1.3.0 calendar get-default-reminders
```

## Creating events

```bash
# Create a single event
uvx gws-cli@1.3.0 calendar create \
  --summary "Team sync" \
  --start 2024-01-15T10:00:00 \
  --end 2024-01-15T11:00:00

# All-day event
uvx gws-cli@1.3.0 calendar create \
  --summary "Conference" \
  --start 2024-01-15 \
  --end 2024-01-16 \
  --all-day

# With location and description
uvx gws-cli@1.3.0 calendar create \
  --summary "Lunch" \
  --start 2024-01-15T12:00:00 \
  --end 2024-01-15T13:00:00 \
  --location "Restaurant XYZ" \
  --description "Monthly team lunch"

# On a specific calendar
uvx gws-cli@1.3.0 calendar create \
  --calendar <calendar-id> \
  --summary "Event" \
  --start 2024-01-15T10:00:00 \
  --end 2024-01-15T11:00:00

# Quick add (natural language)
uvx gws-cli@1.3.0 calendar quick-add "Lunch with Alice tomorrow at noon"

# Recurring event
uvx gws-cli@1.3.0 calendar create-recurring \
  --summary "Weekly standup" \
  --start 2024-01-15T09:00:00 \
  --end 2024-01-15T09:30:00 \
  --rrule "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
```

## Updating events

```bash
# Update title, time, or other fields
uvx gws-cli@1.3.0 calendar update <event-id> \
  --summary "Updated title" \
  --start 2024-01-15T11:00:00 \
  --end 2024-01-15T12:00:00

# Move event to a different calendar
uvx gws-cli@1.3.0 calendar move-event <event-id> --destination <calendar-id>

# Add/remove attendees
uvx gws-cli@1.3.0 calendar add-attendees <event-id> alice@example.com bob@example.com
uvx gws-cli@1.3.0 calendar remove-attendees <event-id> alice@example.com

# RSVP (accept/decline/tentative)
uvx gws-cli@1.3.0 calendar rsvp <event-id> --status accepted
uvx gws-cli@1.3.0 calendar rsvp <event-id> --status declined
uvx gws-cli@1.3.0 calendar rsvp <event-id> --status tentative

# Set reminders on an event
uvx gws-cli@1.3.0 calendar set-reminders <event-id> --minutes 10 --minutes 30

# Set default reminders for a calendar
uvx gws-cli@1.3.0 calendar set-default-reminders --calendar <calendar-id> --minutes 15
```

## Notes

- Always use `send_updates: "none"` equivalent if a flag exists — avoid sending
  notifications to attendees for agent-initiated operations unless the user requests it.
- For calendar-triage style annotation, use `update` to append ✅ or ❌ to the
  event `summary` field only. Never modify recurring event masters; always work
  with the specific instance's event ID.
- Time formats: ISO 8601 (`2024-01-15T10:00:00`) for timed events;
  `2024-01-15` (date-only) for all-day events.
