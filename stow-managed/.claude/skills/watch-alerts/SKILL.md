---
name: watch-alerts
description: >-
  Set up scheduled watchers on the always-on VPS that push an ntfy alert (with a
  deep link) when something becomes available — booking slots, restocks, price
  drops, page changes — and manage the running watchers. Probes the site, agrees
  an approach with the user, then deploys a small stdlib Python watcher on a
  systemd user timer. Alert-only: never books or submits. Auto-invoke BEFORE
  setting up any availability/booking/restock/price watch or managing existing
  watchers. Trigger phrases: "watch for", "alert me when", "notify me when
  available", "booking alert", "reservation watcher", "slot watcher",
  "cancellation alert", "release time", "restock alert", "price drop alert",
  "list watchers", "stop watcher", "remove watcher", "watchctl".
disable-model-invocation: false
---

Every watch is the same loop: **probe -> condition -> notify**. A bespoke single-file
Python watcher polls on a systemd user timer and pushes to ntfy when new matches appear.
The user taps the alert's deep link and finishes the action by hand.

Why alert-only: final steps (bookings, checkouts) sit behind captchas and ToS limits.
Auto-booking, captcha solving, stored site credentials, proxies, stealth plugins and
UA rotation are all out of bounds. If a site blocks the VPS, report it as infeasible
instead of evading.

Tools: `~/.claude/skills/watch-alerts/scripts/watchctl` (manager) and `.../scripts/capture-requests`
(probe helper). Watcher instances live in `~/.local/share/watchers/<name>/`; their code is version-controlled
in the dotfiles repo (see step 7).

## Workflow

Copy this checklist and tick it off:

- [ ] 1. Setup check
- [ ] 2. Intake
- [ ] 3. Probe
- [ ] 4. Prove a positive
- [ ] 5. Propose and confirm
- [ ] 6. Build
- [ ] 7. Record the platform
- [ ] 8. Version-control the watcher
- [ ] 9. Report

1. **Setup check (once per machine).** `grep -c NTFY_TOPIC ~/.config/agent-scripts/env`. If
   absent: generate a topic with `python3 -c 'import secrets;print("watch-"+secrets.token_urlsafe(16))'`,
   append `export NTFY_TOPIC=<topic>` to `~/.config/agent-scripts/env` (keep it chmod 600), and
   tell the user the topic so they can subscribe in the ntfy app. The topic is the only
   secret protecting the channel, so never put it in the repo or in logs.
2. **Intake** with `AskUserQuestion`: what to watch, target date/party/window or condition,
   expiry, and the release time if known.
3. **Probe.** Load `references/probe-ladder.md` (and `references/platforms/*.md` first, if the
   platform is known). Probe from the VPS.
4. **Prove a positive** (a case that should match) before trusting a negative result.
5. **Propose and confirm** with the user: approach (probe rung), schedule (quiet + race), condition,
   alert text and deep link, expiry, known risks. Load `references/booking-patterns.md` for bookings.
6. **Build:**
   `watchctl new <name>` -> fill `check()` and `config.json` -> `watchctl run <name> --dry-run`
   -> `watchctl test-notify` -> `watchctl install <name>` -> `watchctl list` and confirm the next
   elapse time with the user. Never leave a watcher installed without the user's go-ahead.
7. **New platform?** Write `references/platforms/<platform>.md` (endpoints, response shape,
   deep-link format, a tested `check()`); venue-specific facts stay in the watcher config.
   Remind the user to review and commit it.
8. **Version-control the watcher.** The dotfiles repo is public, so first move anything personal
   (home coordinates, addresses, names, party details, anything in `title`) out of `config.json`
   into `config.local.json` (gitignored, deep-merged over `config.json`) and leave placeholders
   in `config.json`. Check `watchctl run <name> --dry-run` still passes, then
   `watchctl adopt <name>` moves `watcher.py` + `config.json` into `stow-managed/.local/share/watchers/<name>/`
   and stows them back as symlinks. Remind the user to review and commit; never commit for them.
9. **Infeasible?** Report why and suggest the manual fallback (a calendar reminder at the release time).

## Watcher contract

`check(params)` returns `[Hit(key, summary)]` for "available", `[]` for "checked, nothing", and
raises `CheckError` for "couldn't check". Keeping those apart is what lets the template detect a
silently broken watcher (alert after `error_threshold` consecutive failures, "recovered" note,
24 h heartbeat). Alerts fire only for keys not already in `state.json`. The watcher disables its own
timers after `expires`.

## Managing watchers

```bash
~/.claude/skills/watch-alerts/scripts/watchctl list                 # name | timer | state | next | last result | expiry
~/.claude/skills/watch-alerts/scripts/watchctl logs <name> -n 50     # journald
~/.claude/skills/watch-alerts/scripts/watchctl run <name> --dry-run  # one check, no push, exit 2 on CheckError
~/.claude/skills/watch-alerts/scripts/watchctl remove <name>         # stops timers, deletes units, archives dir (tracked repo copy is left alone)
```

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/probe-ladder.md** — load when: investigating how a new site exposes availability, or deciding between JSON API, HTML, headless browser, or "infeasible".
- **references/pitfalls.md** — load when: before confirming the plan, if a probe gets 403/429, or when a watcher is silent, erroring, or firing at the wrong time.
- **references/booking-patterns.md** — load when: the watch is a booking/reservation/ticket slot, or a release time or race schedule is involved.
- **references/platforms/sevenrooms.md** — load when: the booking page is on `sevenrooms.com` (`/explore/<key>/reservations/`). Contains a tested `check()`.
- **templates/watcher.py**, **templates/config.example.json** — read as reference only when you need the config fields; `watchctl new` copies them.
