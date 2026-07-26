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

## Migration Paths (When SearXNG Engines Fail Completely)

If `bing`/`mojeek`/`yep` all start failing or returning empty results, there is no
next free engine to add — the anti-bot fingerprinting arms race has caught up to
all of them simultaneously. At that point, migrate `websearch` or the calling
agent to a paid search API. Below are the viable options, ordered by value.

Each migration requires changing the search tool — not just updating
`settings.yml`. The current `websearch` script is wired to SearXNG's JSON API
format. A paid API means a different endpoint, different auth (API key header),
and different response schema.

---

### Option A: Brave Search API (recommended — best value)

| Tier | Cost | Quota | Rate Limit | AI Snippets |
|---|---|---|---|---|
| Free | $0/mo | 2,000 calls/mo | 1 req/s | No |
| Base | $5/mo | 20,000 calls/mo | 20 req/s | Yes |
| Pro | $10/mo | Unlimited (per-call after base) | 100 req/s | Yes |

Runs on Brave's own independent web index (30+ billion pages). No Google or Bing
dependency. The free tier alone covers most personal agent usage.

**How to migrate:** create a new script in `~/bin/agent_scripts/` (or modify
`websearch` with a `-p` / `--provider` flag) that calls:
```
https://api.search.brave.com/res/v1/web/search?q=<query>
Authorization: Bearer <api-key>
```
Response is JSON with `web.results[]` containing `title`, `url`, `description`.
Sign up at https://api-dashboard.search.brave.com/ — free tier gets $5/mo credit.

**Downside:** requires an API key (env var or config file). No longer air-gapped
from the internet — queries go to Brave's servers.

---

### Option B: Kagi Search API

| Product | Cost |
|---|---|
| Search API | $12 per 1,000 requests |
| Content Extraction | $4 per 1,000 pages (clean markdown output) |

The Kagi *subscription* ($5-$25/mo for human browsing) does **not** include API
access — the Search API is separately metered at $12/1k. This is expensive
for agent workloads but provides high-quality, ad-free results with lenses,
domain boosting/blocking, and AI summarization.

**How to migrate:** create a script calling:
```
https://api.kagi.com/v1/search?q=<query>
Authorization: Bot <api-key>
```
Supports `limit`, `lens` (regional/domain filters). Response includes
`data[].url`, `data[].title`, `data[].snippet`.
Sign up at https://kagi.com/api/pricing. API keys managed via Kagi API Portal.

---

### Option C: Tavily

| Tier | Cost | Quota |
|---|---|---|
| Free | $0/mo | 1,000 credits/mo |
| Pay-as-you-go | $0.008/credit | — |
| Monthly plans | $30-$500/mo | Volume discounts |

Purpose-built for LLM/agent retrieval. Unlike raw search APIs, Tavily returns
summarized, extracted content from results — reducing the need for a separate
`webcrawl` step.

**How to migrate:**
```
POST https://api.tavily.com/search
{
  "api_key": "<key>",
  "query": "<query>",
  "search_depth": "basic" | "advanced",
  "include_answer": true | false
}
```
Sign up at https://tavily.com/.

---

### Option D: Firecrawl (search + crawl in one API)

If you often use `websearch` → `webcrawl` as a two-step pipeline, Firecrawl
combines both into a single API call — search + full page extraction as clean
markdown. Pay-as-you-go pricing; free tier available.

Sign up at https://www.firecrawl.dev/.

---

### Option E: Dedicated SearXNG Hosted Instance

If the *Docker container* itself is the problem (image broken, can't run Docker),
but SearXNG as software still works, point the skill at a public or self-hosted
remote instance via `$WEBSEARCH_URL`. The `websearch` script already supports
this — just set the environment variable and it skips Docker entirely.

```bash
export WEBSEARCH_URL="https://my-searxng-instance.example.com"
```

This keeps the same response format and search flow, just changes where the
query goes. The remote instance still faces the same engine-blocking risks,
so this is a deployment-workaround, not a solution to fingerprinting.

---

## Decision Matrix

| If… | Then… |
|---|---|
| You need free + self-hosted | Keep SearXNG; switch engines in `settings.yml` |
| All free engines fail; you want lowest cost | Brave Search API ($5/mo for 20k queries) |
| You want LLM-optimized results (summaries + extraction) | Tavily (free 1k/mo, then $0.008/credit) |
| You want search + page extraction in one call | Firecrawl |
| You want the best raw search quality at any cost | Kagi Search API ($12/1k) |
| Docker is broken but SearXNG software is fine | Use `$WEBSEARCH_URL` with a remote instance |

---

## Longer-Term Context (July 2026)

The SearXNG project is not abandoned, but it has undergone significant
maintainer churn:
- Original Searx creator **asciimoo** left the project, citing "limitations of
the metasearch concept."
- Two of three SearXNG co-founders (**unixfox** and **dalf**) departed in 2025
over diverging project values.
- The `searxng-docker` repository was **archived March 28, 2026** (Docker
build now lives in the main repo).
- Active maintainers (**return42**, **Bnyro**) continue development; latest
release is 2026.7.24 as of this writing.
- The `curl_cffi` TLS-impersonation fix (PR #5468) remains unmerged — the
anti-bot arms race is ongoing.

Free, unauthenticated meta-search is inherently fragile because it relies on
scraping engines that don't want to be scraped. Paying for search changes the
relationship from adversarial to commercial — you become a customer rather than
a bot. The options above are listed in case that transition becomes necessary.

---

## If This Needs Revisiting

- Check whether `duckduckgo`/`brave`/`startpage`/`google` have recovered
  before re-enabling — don't assume the block is permanent, just currently
  in effect. Quick check: restart the container, run a trivial unrestricted
  query, inspect `unresponsive_engines` in the JSON response.
- If `bing`/`mojeek`/`yep` start failing too, consult the Migration Paths
  section above — this is a "re-diagnose from scratch or switch to paid API"
  situation, not a "add another engine to the disabled list" patch.
- Heavier fixes exist upstream but are unmerged/experimental as of 2026-07:
  a `curl_cffi`-based TLS-impersonation DDG engine (PR #5468) and a
  Playwright-based VQD-token-harvesting sidecar
  (`ggfevans/searxng@mod-sidecar-harvester`). Both are real engineering
  investments, not config changes — only worth adopting if losing
  DDG/Brave/Startpage becomes a recurring problem rather than a one-off.
