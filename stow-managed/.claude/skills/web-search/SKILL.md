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

Search the web using `~/bin/agent_scripts/websearch`, which manages a SearXNG
Docker container on-demand (start → query → stop). Do not use the built-in
`WebSearch` tool or `WebFetch` when this is available.

**Prerequisite:** Docker at `/usr/bin/docker`. The script manages the container
lifecycle automatically — no manual Docker steps needed.

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
~/bin/agent_scripts/websearch -e "google,duckduckgo" "site:github.com fast JSON parser"

# Filter by time range
~/bin/agent_scripts/websearch -t day "latest Claude API changes"
~/bin/agent_scripts/websearch -t month "kubernetes 1.31 release notes"
~/bin/agent_scripts/websearch -t year "LLM agent best practices"

# Combine flags
~/bin/agent_scripts/websearch -n 5 -e "brave" -t month "docker security vulnerabilities"
```

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

## Startup Time

First call per session: ~10–15s (Docker image pull on first ever run, then container
startup). The container is stopped and removed after each search — no persistent service.

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
