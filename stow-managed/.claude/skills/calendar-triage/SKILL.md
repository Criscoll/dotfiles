---
name: calendar-triage
description: Review past calendar events missing a ✅ or ❌ outcome annotation and resolve them. Use when user says "triage my calendar", "catch up on calendar", "review unresolved events", "annotate past events", or similar.
disable-model-invocation: false
---

You are running the calendar triage skill. Surface past events missing a ✅ or ❌ outcome annotation, collect all verdicts from the user in one conversational pass, then apply all calendar updates in a single batch. The goal is minimum friction — the user should not have to wait for API calls between answers.

Read the reference file before doing anything else:

```
cat "${CLAUDE_SKILL_DIR}/calendars.md"
```

## Step 1: Parse the lookback window

Default: 7 days back from today.

`$ARGUMENTS` may override this. Parse it generously:
- `2 weeks` / `14 days` → 14 days back
- `3 months` → 90 days back
- `since 2025-11-01` / `since november` → from that date
- A bare ISO date (`2025-11-01`) → from that date

Tell the user: "Fetching events from [date] to today across 7 calendars..."

## Step 2: Fetch events

Query each of the 7 calendars in `calendars.md` with `get_events` in parallel:
- `time_min` / `time_max` from Step 1
- `max_results: 200`
- `detailed: true`

## Step 3: Build the triage list

1. Exclude events ending after today
2. Apply auto-skip rules from `calendars.md` silently (no mention to user)
3. Sort remainder chronologically, oldest first

If 0 events remain: "Nothing to triage — all events in this window are already annotated." Stop.

## Step 4: Present the full list and collect verdicts

Show all events as a compact numbered list. The user should be able to scan and respond to everything in one message.

```
Found N events to triage (Mon 1 Dec 2025 → today). Here they are:

Verdicts: d=✅done  m=❌missed  s=skip  r=reschedule (to today or a date)  del=delete

  1. 01 Dec  Capture/Reminders    Evening Routine + Slept Early
  2. 01 Dec  Exercise             Gym - Legs
  3. 03 Dec  Personal             Look into black spots in bathroom shower
  4. 05 Dec  Important Events     Date Night
  5. 05 Dec  Goals                Goals for the Day — email ring shops, financial spreadsheet
  ...

Reply with a verdict per number, e.g: "1m 2d 3r:today 4s 5d"
You can do them all at once or a few at a time — I'll apply everything after you're done.
```

If there are more than 30 events, present the first 30 and note how many remain.

Include a description snippet (first line only) when it adds useful context, e.g. for Goals entries.

## Step 5: Collect all verdicts before applying anything

Parse verdicts as the user provides them. Accept:
- `Nd` / `N done` / `N ✅` / `N tick` → ✅ done
- `Nm` / `N missed` / `N ❌` / `N cross` → ❌ missed
- `Ns` / `N skip` → no annotation (exempt event, no API call)
- `Nr` / `Nr:today` / `Nr:monday` / `Nr:2026-05-10` / `Nr: next week` → reschedule
- `Ndel` → delete

**Do not call any APIs yet.** Keep accumulating verdicts.

If the user provides verdicts in multiple messages (e.g. "1-10 done, 11 missed..."), just keep collecting.

Once the user signals they're done (or has covered all events), check for any reschedules missing a target date. If any, ask for them all in one go:
"What date for: #3 'Look into black spots', #9 'Follow up on plumber'? (today / a date / next week etc.)"

## Step 6: Confirm and apply in batch

Briefly confirm what you're about to do, then run all `manage_event` calls in parallel.

**For ✅ or ❌:**
- `action: "update"`
- `summary: "[original title] ✅"` (or ❌) — one space before the symbol
- `send_updates: "none"`

**For reschedule:**
- `action: "update"`
- `start_time` and `end_time` set to the new date
- All-day events: date-only `YYYY-MM-DD`, end = day after start
- Do NOT append ✅/❌ — task is still open
- `send_updates: "none"`

**For delete:**
- `action: "delete"`, `send_updates: "none"`

**For skip:** no API call.

## Step 7: Summary

```
Done: 12 ✅  4 ❌  3 rescheduled  2 deleted  5 skipped
```

If batching: "Ready for items 31–N when you are."

## Key rules

- Never modify a recurring event's master — only the fetched instance's event ID scopes correctly
- Always `send_updates: "none"` on every call
- Preserve exact existing titles — append ` ✅` or ` ❌`, don't reformat
- "Today" is always a valid reschedule target
- Trust the user's verdicts without second-guessing
