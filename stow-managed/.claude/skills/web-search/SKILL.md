---
name: web-search
description: >-
  Search the web on-demand via a local SearXNG instance (Docker-backed). Use for
  live web search, recent news, current documentation, or any query that needs
  real-time results. Auto-invoke BEFORE attempting to answer questions requiring
  current information. Trigger phrases: "search the web", "look this up", "find
  recent", "what's the latest on", "search for", "web search", "find online",
  "current status of", "look up".
disable-model-invocation: false
---

Search the web using `~/bin/agent_scripts/websearch`, which manages a persistent
SearXNG Docker container (starts on first use, stays running). Do not use the
built-in `WebSearch` tool or `WebFetch` when this is available.

**Prerequisite:** Docker at `/usr/bin/docker`. The script manages the container
lifecycle automatically — no manual Docker steps needed.

**Under Paseo:** if `WEBSEARCH_URL` is set (the Paseo container points it at an
always-warm `searxng` compose sidecar), the script talks to that endpoint
directly and skips the Docker prereq/lifecycle entirely — the warm/cold check
below does not apply.

## Script Check — Do This First

`websearch` is in `agent_scripts/` and deliberately not on `$PATH`. Call by full path:

```bash
ls ~/bin/agent_scripts/websearch
```

If missing, stow from the dotfiles repo hasn't been run or the file wasn't created.
Do not attempt a fallback.

## Common Usage

```bash
# Basic search — returns JSON array on stdout (~10–15s first run)
~/bin/agent_scripts/websearch "python asyncio best practices"

# Limit results (default: 10)
~/bin/agent_scripts/websearch -n 5 "rust ownership tutorial"

# Restrict to specific engines
~/bin/agent_scripts/websearch -e "bing,mojeek" "site:github.com fast JSON parser"

# Filter by time range
~/bin/agent_scripts/websearch -t day "latest Claude API changes"
~/bin/agent_scripts/websearch -t month "kubernetes 1.31 release notes"
~/bin/agent_scripts/websearch -t year "LLM agent best practices"

# Combine flags
~/bin/agent_scripts/websearch -n 5 -e "mojeek" -t month "docker security vulnerabilities"
```

**Default engines** (`settings.yml`) are currently `bing`, `mojeek`, `yep`
(plus `wikipedia`/`wikidata`). `duckduckgo`/`brave`/`startpage`/`google` are
disabled — they reliably CAPTCHA/rate-limit-block this network. See
`references/engine-blocking.md` before re-enabling any of them.

## Output Format

JSON array on stdout; diagnostic messages on stderr:

```json
[
  {
    "title": "Result title",
    "url": "https://example.com/page",
    "snippet": "Relevant excerpt from the page...",
    "engine": "google"
  }
]
```

**Typical follow-up:** feed the best URLs into `webcrawl` for full page content:

```bash
# 1. Search for relevant pages
~/bin/agent_scripts/websearch "asyncio event loop internals" > /tmp/search.json

# 2. Fetch full content from the best result
webcrawl "https://docs.python.org/3/library/asyncio-eventloop.html"
```

## Startup Time and Parallel Searches

First call per session: ~10–15s (Docker image pull on first ever run, then container
startup). The container stays running between searches (persistent service).

**When running multiple searches:** check whether the container is already warm before
issuing parallel calls. Parallel cold-start calls race to start the container and the
losers may fail — run one search first if the container is cold.

```bash
# Check warmth — exits 0 if warm, non-zero if cold
/usr/bin/docker inspect --format='{{.State.Running}}' searxng-websearch 2>/dev/null \
  | grep -q "^true$" && echo warm || echo cold
```

- **Warm**: parallelize freely — container is already up.
- **Cold**: run one search first (~10–15s warm-up), then parallelize the rest.

## When to Use / Not Use

Use `websearch` for:
- Questions requiring current or real-time information
- Recent news, release notes, CVEs, changelogs
- Verifying whether a library/API still exists or has changed
- Finding URLs to feed into `webcrawl` for full content

Do NOT use for:
- Fetching a specific known URL → use `webcrawl` directly
- Visual inspection of rendered pages → use **web-scrape** skill
- Local file search → use `rg` or `fd`

## Docker Prerequisite

Requires Docker at `/usr/bin/docker`. If the script exits with
"docker not found", Docker is not installed. Do not attempt a fallback —
surface the error to the user.

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/engine-blocking.md** — load when: a search returns an empty
  results array (including for trivial queries), `docker logs
  searxng-websearch` shows `SearxEngineCaptchaException` or `Suspended`
  errors, or before re-enabling `duckduckgo`/`brave`/`startpage`/`google` in
  `settings.yml`.
