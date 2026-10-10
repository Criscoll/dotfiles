# Probe ladder

Goal: find the cheapest reliable way to ask "is it available?" from the VPS, and
prove it works before building a watcher around it. Probe from the VPS itself:
a request that works from a laptop can be blocked from a datacenter IP.

## Procedure

1. **Known platform?** List `references/platforms/`. Identify the platform from the
   booking widget's script/host names (page source, or `browser-eval
   'performance.getEntriesByType("resource").map(r=>r.name)'`). If a platform note
   exists, start from its endpoints and skip to step 3.
2. **Capture requests while driving the widget.** `browser-start`, then in the
   background `~/.claude/skills/watch-alerts/scripts/capture-requests --seconds 90 > /tmp/cap.jsonl &`,
   then `browser-nav` / `browser-click` through the booking flow (set the target
   date/party). Read `/tmp/cap.jsonl` for the call that returns availability. Stop
   the browser afterwards; this box has little spare RAM.
3. **Replay with `curl` from the VPS, no cookies.** Check: does it return 200 without
   auth? Which params are required (strict-validation APIs list them in the 400)?
   Does a plain `curl` User-Agent work, or only a browser one?
4. **Pick the availability field and the condition** (e.g. a slot `type`, a
   `stock > 0` flag, a price below X, a text match).
5. **Prove a positive.** Run the check against a case that should match (a near
   date, a small party, an in-stock item) and confirm it returns a hit before trusting
   a negative. If no positive can be found, say so; the watcher may be watching for
   something this venue never exposes (e.g. every slot is request-only).
6. **Find the release policy** from the site FAQ or page text (when slots appear, how
   far ahead, cancellation rules) and put it in the config / alert text.

## Rungs, in order of preference

1. **JSON API over plain HTTP.** Stdlib watcher, any interval.
2. **Static HTML**, parsed with stdlib `html.parser` or a regex. Same watcher shape.
3. **Headless Playwright.** Only if the site is JS-only but not blocking the VPS.
   Interval >= 15 min, `"memory_max": "512M"` in config, add `playwright==1.60.0` to the
   watcher's PEP 723 `dependencies`. The VPS has about 250 MB free, so this is the
   risky rung.
4. **Infeasible: bot-blocked from the VPS** (403/captcha wall on the first request).
   Report it and suggest the manual fallback: a calendar reminder at the release
   time via the `calendar-management` skill. Do not evade the block (see `pitfalls.md`).
