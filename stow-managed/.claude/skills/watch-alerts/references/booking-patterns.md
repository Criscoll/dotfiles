# Booking-watch patterns

For restaurant/campsite/ticket slots that appear at a fixed release time or via cancellations.

## Two-phase schedule

1. **Quiet phase.** `schedule` = `*-*-* *:0/5:00` (every 5 min) from install until `expires`.
   Catches early releases and cancellations. Add `jitter_sec` (about 20) so polls aren't on the dot.
2. **Release race.** If the release time is known, set `race` in config:
   `{"at": "<date> <HH:MM:SS> <IANA tz>", "duration_min": 40, "interval_sec": 3}`, with `at`
   about 10 min before the release. `watchctl install` makes a second timer that runs
   `watcher.py --race`. While it runs, the quiet-phase timer finds the lock held and exits quietly.

Compute the release date from the policy (e.g. "30 days ahead at 7:00 am" -> target date
minus 30 days, venue-local), and state the UTC equivalent when you confirm with the user.

## Slot types

Many platforms distinguish instantly bookable slots from request-only ones
(SevenRooms `book` vs `request`). Decide with the user which counts as a hit, and
check which types the venue actually exposes (see `platforms/sevenrooms.md`).

## Deep-link handoff

The alert's tap target (`deep_link`) must prefill date and party size so the human
only completes the final step (captcha + submit, about 60 s). Verify the link in a
browser before relying on it, using a date that is currently releasable (a not-yet-
released date may display a different date).

## Put venue policies in the alert

Surface things the user must act on right after booking: unconfirmed bookings
cancelled, a confirmation call/reply needed, min spend, auto-allocated rooms for
big parties. Put them in the config `title` or a note in the summary.

## Clock sanity

Race timing relies on the VPS clock: `timedatectl show -p NTPSynchronized` should say `yes`.
