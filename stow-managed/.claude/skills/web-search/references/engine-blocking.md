# Engine Blocking: DuckDuckGo/Brave/Startpage/Google (2026-07)

## Symptom

`websearch` (or a raw call to the SearXNG API) returns an empty results array
for every query, including trivial ones like `"python"`.

## Root Cause

Not a broken image, not a misconfiguration — the underlying search engines are
actively anti-bot-blocking this network's egress IP. Confirmed via
`docker logs searxng-websearch`:

- **DuckDuckGo**: `SearxEngineCaptchaException` on every request. As of
  ~2026-01 DDG moved from a static CAPTCHA to a JS-driven "anomaly" challenge
  (`anomaly.js`) — a plain HTTP request (even with perfect browser headers,
  forced HTTP/1.1) gets served the JS challenge page, not results. Upstream
  tracking issue: [searxng#4824](https://github.com/searxng/searxng/issues/4824)
  (open since 2025-05, no merged fix as of 2026-03; SearXNG maintainer
  describes it as an arms race the project is currently losing).
- **Brave**: `Suspended: too many requests`.
- **Startpage**: `Suspended: CAPTCHA`.
- **Google**: no exception raised, but silently returns 0 results — the
  scraper likely receives a bot-check page it doesn't recognize as an error.

### Tested and ruled out: "borrow a real browser session"

Some comments on #4824 report that one real-browser hit against
`https://html.duckduckgo.com/html/` from the *same egress IP* temporarily
unblocks the IP for a few minutes. Verified experimentally on this machine on
2026-07-11:

```bash
firefox --no-remote --profile /tmp/ff-profile --headless \
  --screenshot="/tmp/ddg.png" "https://duckduckgo.com/?q=test&ia=web"
```

This loaded a completely clean DDG results page (no CAPTCHA/anomaly) from
this machine's IP — confirming the IP itself isn't universally poisoned.
Immediately re-querying SearXNG afterward still got the CAPTCHA exception.

**Conclusion:** the block is not (purely) IP-reputation based anymore. DDG is
fingerprinting at the client/TLS level (SearXNG's Python `httpx` stack vs. a
real Firefox TLS/HTTP2 fingerprint) — consistent with the later comments on
#4824 discussing `curl_cffi` browser impersonation as the only evasion that
still has traction. A real browser session on the same IP does **not**
launder SearXNG's own requests.

## Workaround Applied

Rather than chase an evolving fingerprinting arms race, `settings.yml` now
disables the four broken/unreliable engines and enables three confirmed-good
alternatives that are disabled by default upstream:

```yaml
engines:
  - name: duckduckgo
    disabled: true
  - name: brave
    disabled: true
  - name: startpage
    disabled: true
  - name: google
    disabled: true
  - name: bing
    disabled: false
  - name: mojeek
    disabled: false
  - name: yep
    disabled: false
```

Verified working (2026-07-11): `bing` and `mojeek` return real results
reliably; `yep` works most of the time but occasionally returns
`access denied` — treat it as a bonus engine, not load-bearing.
`wikipedia`/`wikidata` remain enabled (default) and are useful for
infobox-style factual lookups but aren't a general web-search substitute.

## If This Needs Revisiting

- Check whether `duckduckgo`/`brave`/`startpage`/`google` have recovered
  before re-enabling — don't assume the block is permanent, just currently
  in effect. Quick check: restart the container, run a trivial unrestricted
  query, inspect `unresponsive_engines` in the JSON response.
- If `bing`/`mojeek`/`yep` start failing too, this is a "re-diagnose from
  scratch" situation, not a "add another engine to the disabled list" patch —
  the underlying cause (anti-bot fingerprinting) evolves independently of
  any one engine.
- Heavier fixes exist upstream but are unmerged/experimental as of 2026-07:
  a `curl_cffi`-based TLS-impersonation DDG engine (PR #5468) and a
  Playwright-based VQD-token-harvesting sidecar
  (`ggfevans/searxng@mod-sidecar-harvester`). Both are real engineering
  investments, not config changes — only worth adopting if losing
  DDG/Brave/Startpage becomes a recurring problem rather than a one-off.
