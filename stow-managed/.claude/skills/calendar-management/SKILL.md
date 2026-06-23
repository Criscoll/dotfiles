---
name: calendar-management
description: >-
  Apply calendar task-management conventions — tick/cross completion marks,
  note prefixes, carry-forward rules, and date-bound missed-event handling.
  Auto-invoke BEFORE creating, updating, or reviewing any calendar event, or
  when triaging past-due tasks. Trigger phrases: "calendar", "tick", "cross",
  "✅", "❌", "carry forward", "event", "calendar-update", "calendar-create",
  "calendar-list", "mark complete", "update event", "completed task", "due date",
  "missed", "overdue", "pending task", "reschedule event", "move event".
---

# Calendar Management Conventions

This skill implements the established calendar-triage conventions. All operations go through the wrapper scripts in `~/bin/agent_scripts/`. Direct `gws-cli` calls are blocked by the guard hook.

Read both reference files before doing any calendar work:

```bash
cat "${CLAUDE_SKILL_DIR}/../../google-workspace/calendar.md"
```

Also read the checklist reference for operational steps:

```bash
cat "${CLAUDE_SKILL_DIR}/references/operations.md"
```

## Conventions

### 1. Completion marks (summary suffix)

Every event summary belongs to one of these states. Append the symbol **after a space** at the end of the summary — never in the middle or at the start:

| Symbol | Meaning | Example |
|---|---|---|
| (none) | Pending / not yet done | `Deposit for engagement ring` |
| `✅` | Completed | `Book dental appointment ✅` |
| `❌` | Date-bound event that was missed | `Reservation at NOMAD Sydney ❌` |

Why trailing suffix rather than prefix: it keeps the task name visible and readable, especially on mobile calendar views where the start of the title is what you see first. The symbol is a quick scan-time cue after you've already read the name.

### 2. Note prefix (`- `)

Events that are personal reflections, journal entries, reminders, or thoughts — not actionable tasks — get a **hyphen-space prefix** to distinguish them from action items at a glance:

| Format | Example |
|---|---|
| `- <reflection text>` | `- Your so unbalanced it's killing you` |
| (no prefix) | `Deposit for engagement ring` ← actionable |

Why hyphen: it's on the main keyboard screen on every phone keyboard (no emoji switcher needed), quick to type, and visually distinct enough in a calendar list to tell notes from tasks.

### 3. Recurring schedules — never touch the master

These events are fixed calendar anchors, not tasks. They must never receive a tick, cross, or note prefix:

- `Relationship: Check in w Mimi on Progress`
- `Monthly Review`
- `Monthly ETF DCA`
- Any other fixed recurring event

Only update **specific instances** (the event ID with a `_YYYYMMDD` suffix) if needed. Never modify the recurring master. If an instance of a recurring event needs a note, add it to the description rather than the summary.

### 4. Carry-forward rules

When you encounter a past-due event that is still pending (no ✅, no ❌):

1. **Classify the event:**
   - **Date-bound** — tied to a specific date/time that can't move (flight, reservation, appointment, fixed booking). Mark with `❌` — it's missed.
   - **Actionable task** — something that needed doing but isn't date-specific (pay bills, call someone, buy something). Carry it forward.

2. **Carry-forward mechanics:**
   - Move the event's start/end to the **next available day** on the calendar that doesn't already have a heavy task load.
   - Update the summary as-is (no ✅, no ❌ — it's still pending).
   - Keep the original description intact.

3. **Non-actionable notes from the past:**
   - Past-due notes (prefixed with `- `) are low-urgency — don't carry them forward unless they're still relevant. Use judgment: if it's a permanent insight, move it; if it was situational, let it expire.

### 5. Completion happens on the actual date of completion

When a task is done:
- Update its summary to append `✅`.
- If you completed it on a **different day** than the event was scheduled, move the event's start/end to the date you actually did it. This keeps the calendar as a true record of when things happened, not when they were planned.
- If it's a same-day completion, just append the ✅ — no date change needed.

### 6. What is NOT available (hook-enforced)

The following calendar operations are structurally blocked by the guard hook. Do not attempt them and do not suggest them unless the user explicitly asks and understands the limitation:

- `delete` — cannot delete events (including test/stale events)
- `clear-calendar`, `delete-calendar` — cannot destroy calendars
- Modifying the recurring event master — never do this regardless of hook restrictions

If the user asks you to do something blocked, tell them it's structurally unavailable and suggest they do it manually.

## Event lifecycle (quick reference)

```
Created as:           "Book dental appointment"
                        ↓
Completed same day:   "Book dental appointment ✅"  (update summary, no date change)
                        ↓
Completed later:      "Book dental appointment ✅"  (update summary + move date)
                        ↓
Missed (date-bound):  "Book dental appointment ❌"  (update summary, leave date)
                        ↓
Carried forward:      "Book dental appointment"     (move date only, no symbol change)
```

## Relationship to other skills

This skill works alongside the **google-workspace** skill for calendar I/O operations. The google-workspace skill covers *how* to use the wrapper scripts (`calendar-list`, `calendar-update`, `calendar-create`); this skill covers *what* to write when using them (conventions for summaries, dates, and task states). When doing calendar work, load this skill for the conventions and the google-workspace skill for the command surface.