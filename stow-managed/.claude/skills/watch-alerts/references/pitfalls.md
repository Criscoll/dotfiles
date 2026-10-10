# Pitfalls

- **Datacenter IP blocking.** Cloudflare/DataDome/Akamai flag VPS IPs. A 403 or
  challenge page on the very first request points at the IP, not at your headers.
  That is the "infeasible" rung; report it.
- **Fingerprinting.** TLS and header fingerprinting can reject non-browser clients.
  A realistic `User-Agent` (already in the template) is fine; do not escalate to
  proxies, stealth plugins or UA rotation. That is bot-detection evasion and is out of bounds.
- **429s.** Back off (the template sleeps 30 s after a 429 in `--race`). Polite
  intervals: quiet phase >= 5 min, race >= 2-3 s, bounded to about 40 min.
- **Silent failure.** A schema change, moved endpoint or expired token makes a naive
  watcher report "nothing available" forever. Keep `check()` strict: unexpected shape
  raises `CheckError`; the template then alerts after `error_threshold` failures and
  sends a daily heartbeat so silence is never ambiguous.
- **Alert fatigue.** Alert only on keys not yet in `state.json` `notified_keys`.
- **Timezones.** The VPS clock is UTC. Release times are venue-local, so give
  `OnCalendar` an IANA zone (`2026-11-14 06:50:00 Australia/Sydney`); systemd 255
  supports this. Expiry uses the config `timezone`.
- **systemd timer accuracy.** The default `AccuracySec=1min` silently breaks
  second-level timers; `watchctl` sets `AccuracySec=1s`. `Persistent=true` catches up
  only one missed run, so don't rely on it; `watchctl` sets it false.
- **ntfy topic = password.** Anyone who knows the topic can read and post. Keep it only
  in `~/.config/agent-scripts/env`. ntfy.sh allows a burst of about 60 messages then
  one per 5 s, and caps messages at about 4 KB (the template truncates).
- **Memory.** The VPS has about 1.9 GiB RAM with about 250 MB free. Headless browsers
  can OOM it; cap with `memory_max`.
- **Captchas mean a human handoff.** Never script a submit. Keep to personal,
  low-frequency, read-only polling (also the ToS-safest posture).
