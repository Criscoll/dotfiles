---
name: web-search
description: >-
  Search the web on-demand — Brave Search API primary (search + extracted page
  content in one call, no Docker), local SearXNG Docker instance as automatic
  fallback. Use for live web search, recent news, current documentation, or any
  query that needs real-time results. Auto-invoke BEFORE attempting to answer
  questions requiring current information. Trigger phrases: "search the web",
  "look this up", "find recent", "what's the latest on", "search for", "web
  search", "find online", "current status of", "look up".
disable-model-invocation: false
---

Search the web using `~/bin/agent_scripts/websearch`, a tiered search wrapper:

- **Primary — Brave Search API.** By default uses the LLM Context endpoint:
  search and pre-extracted page content arrive together in one call, so most
  searches need **no follow-up crawl**. No Docker, sub-second response.
- **Fallback — SearXNG** (Docker-backed, via `websearch-searxng`). The wrapper
  delegates automatically when no API key is present or the Brave call fails
  (invalid key, quota, rate limit, network). The stderr banner says which
  provider served each search — read it so you know whether content came back.

Do not use the built-in `WebSearch` tool or `WebFetch` when this is available.

## Script Check — Do This First

```bash
ls ~/bin/agent_scripts/websearch
```

If missing, stow from the dotfiles repo hasn't been run. Do not attempt a fallback.

## Common Usage

```bash
# Default — Brave LLM Context: results WITH extracted page content (~$5/1k reqs)
~/bin/agent_scripts/websearch "python asyncio best practices"

# Limit results (default 10, Brave caps at 50)
~/bin/agent_scripts/websearch -n 5 "rust ownership tutorial"

# Freshness filter
~/bin/agent_scripts/websearch -t day "latest Claude API changes"
~/bin/agent_scripts/websearch -t month "kubernetes 1.31 release notes"

# Raw search — cheapest (titles + snippets only). Use when you just need
# candidate URLs, then invoke the web-crawl skill for the best hits.
~/bin/agent_scripts/websearch --search-only -n 5 "site:github.com fast JSON parser"

# Force the SearXNG fallback (e.g. testing, or Brave quota is known-exhausted)
~/bin/agent_scripts/websearch --provider searxng "docker security vulnerabilities"
```

## Output Format

JSON array on stdout; provider/diagnostics on stderr:

```json
[
  {
    "title": "Result title",
    "url": "https://example.com/page",
    "snippet": "Extracted page content (LLM Context) or excerpt (raw search)...",
    "engine": "brave-llm-context"
  }
]
```

`engine` tells you the provenance: `brave-llm-context` (content included),
`brave` (raw snippets), or the SearXNG engine name (fallback; snippets only).

## Content Rule — When to Crawl

- **Default Brave path (`engine: brave-llm-context`):** snippets carry
  relevance-extracted page content. Answer from them directly. Invoke the
  **web-crawl** skill only when snippets are insufficient, you need the
  *complete* document, or the key sources returned no extractable content.
- **Raw search (`--search-only`) or SearXNG fallback:** results are
  titles/snippets only — after picking the best hits, invoke the **web-crawl**
  skill to fetch full content before answering. Don't stop at the results list.

## API Key Setup (per machine)

The key lives in `~/.config/agent-scripts/env` (untracked, chmod 600); the
wrapper sources it itself — agents never need the var exported in their shell.

```bash
mkdir -p ~/.config/agent-scripts
echo 'export BRAVE_API_KEY="<key from password manager>"' > ~/.config/agent-scripts/env
chmod 600 ~/.config/agent-scripts/env
```

If neither the file nor `$BRAVE_API_KEY` exists, the wrapper falls back to
SearXNG automatically — no key is required for the skill to function.

**Cost note:** ~$5/1k requests (search and LLM Context both count as requests);
$5 of free credits is applied automatically every month. Prefer `--search-only`
for high-volume URL-hunting; use the default for content-grounded answers.

## SearXNG Fallback Details

The fallback runs a persistent SearXNG Docker container (`searxng-websearch`,
starts on first use, stays running). Requires Docker at `/usr/bin/docker` and
`~/.config/searxng/settings.yml` (stow-managed). Under Paseo, `WEBSEARCH_URL`
points the fallback at an always-warm sidecar and Docker is skipped.

**Startup time and parallel searches:** first SearXNG call per session is
~10–15s (container cold start). Check warmth before parallel calls:

```bash
/usr/bin/docker inspect --format='{{.State.Running}}' searxng-websearch 2>/dev/null \
  | grep -q "^true$" && echo warm || echo cold
```

- **Warm**: parallelize freely.
- **Cold**: run one search first (~10–15s), then parallelize the rest —
  parallel cold-starts race to start the container and the losers may fail.

## When to Use / Not Use

Use `websearch` for:
- Questions requiring current or real-time information
- Recent news, release notes, CVEs, changelogs
- Verifying whether a library/API still exists or has changed
- Finding URLs to feed into `webcrawl` for full content

Do NOT use for:
- Fetching a specific known URL → use `webcrawl` directly
- Visual inspection of rendered pages → use **browser-inspect** skill
- Local file search → use `rg` or `fd`

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/engine-blocking.md** — load when: a SearXNG-fallback search
  returns an empty results array (including for trivial queries), `docker logs
  searxng-websearch` shows `SearxEngineCaptchaException` or `Suspended`
  errors, or before re-enabling `duckduckgo`/`brave`/`startpage`/`google` in
  `settings.yml`.
