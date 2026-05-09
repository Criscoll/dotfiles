# Calendar Triage Reference

## Calendars to scan

| Name | Calendar ID |
|---|---|
| 00. Personal Calendar | cristiand2021@gmail.com |
| 01. Important Events | 8ea572bf0778ac8c77c8417ee697bc7b94f70e1d7763984dfe64e4e5fddf02fe@group.calendar.google.com |
| 02. Chores | family13688561606332080761@group.calendar.google.com |
| 03. Capture / Reminders | a6560fd6074976a9364691677a204c5c14ce4ad3a94b766e8a6175955b3bd162@group.calendar.google.com |
| 04. Exercise | 7d2ad28a9792ca5bb5b6beb17fdd3c0494742f55f23a7cc9b938598c3649df31@group.calendar.google.com |
| 05. Goals | d7e8d2283058b1cf4501917e8a924a8d623fbcc595f5e7f1abc80cd88d823997@group.calendar.google.com |
| CliMi | 3bfd187edcbf9f114187a067bbbead03ed0b1ca935be96256e1cc9c3bd50d431@group.calendar.google.com |

## Calendars to skip entirely

- **Ideal Week** — planning template, not real events
- **mimitran1305@gmail.com** — partner's calendar, not owned by the user
- **Holidays in Australia** — public holidays, informational only
- **Holidays and Travel** — informational markers
- **06. Time Tracker** — auto-logged, no events requiring annotation

## Auto-skip rules (skip without asking)

Apply these silently — do not present these events for triage:

1. **Already annotated** — title ends with ✅ or ❌
2. **Pure date markers** — recurring events whose sole purpose is marking a date:
   - Birthdays (`Birthday`, `X's Birthday`)
   - Anniversaries with emoji (e.g. `PengQuok Anni ❤️`)
   - Calendar day labels (`Valentines Day`, `Christmas Day`, etc.)
3. **Financial auto-reminders** — direct debits, bills, scheduled payments (e.g. `Energy Locals Direct Debit`)
4. **Multi-day planning documents** — events spanning an entire week or month that serve as goal containers rather than tasks (e.g. `Goals for the Month (January)`, `Goals for the Week` when they span 7+ days). Note: single-day `Goal of the Day` / `Goals for the Day` entries ARE action items and should be triaged.

## Exemption ambiguity — use judgement

Some events fall between marker and action item. Use these signals:

- **Recurring with no description, generic noun title** (e.g. `Date Night`, `Valentines Day`) → likely a marker, lean toward skip but ask if unsure
- **Contains a time in the title** (e.g. `Dental Appointment @ 12:15`, `Park Potluck @ 13:00`) → real event that happened, needs ✅ or ❌
- **Action verb in title** (e.g. `Follow up on...`, `Book...`, `Call...`, `Buy...`, `Look into...`) → todo item, needs ✅ or ❌, or reschedule if the task is still pending
- **Recurring habits** (exercise, chores, sleep routine, medication) → always need ✅ or ❌
- **Reviews** (Weekly Review, Monthly Review) → need ✅ or ❌

## Updating event titles

Use `manage_event` with `action: "update"`, providing:
- `calendar_id` — the calendar the event belongs to
- `event_id` — the event's ID
- `summary` — the existing title with ✅ or ❌ appended (e.g. `"Book dental appointment ✅"`)
- `send_updates: "none"` — avoid sending spurious notifications
- Do not pass `start_time` or `end_time` when only updating the title

For **reschedule**: update `start_time` and `end_time` to the new date. For all-day events use date-only format (`YYYY-MM-DD`). Do not append ✅ or ❌ when rescheduling — the event is still pending.
