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

### 3. Recurring schedules — never touch the master; use `calendar-create-recurring` for new series

**Creating a new series:** use `calendar-create-recurring`, not `calendar-create`. Pass `--all-day` for all-day series (end date is exclusive — use next calendar day). Always pass `--timezone` explicitly for time-based series; the default UTC may produce events at the wrong local time.

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

## Multi-calendar awareness

**This account has multiple calendars, not just Primary.** Triage covers all of the following — for each one, run the same `calendar-list --from ... --to ... --calendar <id>` pass you'd do for the primary:

| Calendar | ID |
|---|---|
| 00. Personal Calendar (primary) | `cristiand2021@gmail.com` |
| 01. Important Events | `8ea572bf0778ac8c77c8417ee697bc7b94f70e1d7763984dfe64e4e5fddf02fe@group.calendar.google.com` |
| 02. Chores | `family13688561606332080761@group.calendar.google.com` |
| 03. Capture / Reminders | `a6560fd6074976a9364691677a204c5c14ce4ad3a94b766e8a6175955b3bd162@group.calendar.google.com` |
| 04. Exercise | `7d2ad28a9792ca5bb5b6beb17fdd3c0494742f55f23a7cc9b938598c3649df31@group.calendar.google.com` |
| 05. Goals | `d7e8d2283058b1cf4501917e8a924a8d623fbcc595f5e7f1abc80cd88d823997@group.calendar.google.com` |
| 06. Time Tracker | `2d2d09f71b92dcdb2004d2b51f846ba560d4dfdad5b115b40c416ae96a09c8c0@group.calendar.google.com` |
| Holidays and Travel | `7a434e3ead1496b607442447dd7d39fe4b697d55e24955c7137981755aa8816a@group.calendar.google.com` |
| Ideal Week | `eaed83e2a9692f2774cff6bec93f43e6b1b7833394ce0f7b1abceb5486f57aee@group.calendar.google.com` |
| Holidays in Australia | `en.australian#holiday@group.v.calendar.google.com` |

**Not in triage scope** (skip these entirely):
- `mimitran1305@gmail.com` — Mimi's personal calendar, shared with this account
- `CliMi` — joint calendar, not for solo triage

The `--calendar <id>` flag is accepted by `calendar-list`, `calendar-get`, `calendar-create`, and `calendar-update`.

## Relationship to other skills

This skill works alongside the **google-workspace** skill for calendar I/O operations. The google-workspace skill covers *how* to use the wrapper scripts (`calendar-list`, `calendar-update`, `calendar-create`); this skill covers *what* to write when using them (conventions for summaries, dates, and task states). When doing calendar work, load this skill for the conventions and the google-workspace skill for the command surface.