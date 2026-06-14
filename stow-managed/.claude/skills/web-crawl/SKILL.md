---
name: web-crawl
description: >-
  Direct all web page fetching through the local `webcrawl` binary instead of WebFetch, curl, or MCP tools — provides JS rendering, anti-bot evasion, and structured extraction. Auto-invoke BEFORE fetching any URL, using WebFetch, scraping a page, or extracting web content. Trigger phrases: "crawl", "scrape", "fetch this URL", "get content from", "read this page", "web crawl", "extract from website", "visit this URL".
disable-model-invocation: false
---

When fetching or extracting content from any web URL, use the local `webcrawl` binary. Do not use WebFetch, `curl`, MCP crawling tools, or any other fetch mechanism for web page content.

## Binary Check — Do This First

Before attempting any crawl, verify the binary is available:

```bash
which webcrawl
```

If `webcrawl` is not found, **stop immediately** and tell the user:

> `webcrawl` is not available on this machine. It should be installed at `~/bin/webcrawl` (via the dotfiles stow-managed/bin/ wrapper). Check that stow has been run and that `~/bin` is in `$PATH`.

Do not attempt any fallback (WebFetch, curl, MCP). Surface the installation issue so the user can fix it.

## Discovering Capabilities

Always check `--help` before assuming what flags are available — the binary may have been updated:

```bash
webcrawl --help
```

This is the authoritative source for flags, output formats, and filtering options.

## Common Usage Patterns

```bash
# Clean markdown — default, most tasks
webcrawl https://example.com

# Markdown + all links (good for navigation / further crawling)
webcrawl https://example.com --links

# JSON output — use when you need structured data or are chaining calls
webcrawl https://example.com --json

# JSON + links — single-shot fetch for agentic navigation
webcrawl https://example.com --json --links

# Topic-focused content (BM25 scoring, drops off-topic blocks)
webcrawl https://example.com --filter "authentication"
```

## Web Search + Crawl Tandem Pattern

For research tasks, combine `WebSearch` with `webcrawl`:

1. **Search first** with `WebSearch` to discover relevant URLs
2. **Crawl second** with `webcrawl` to fetch full content of the most relevant pages

```
WebSearch("python asyncio cancel task best practices")
  → identifies 3 useful URLs

webcrawl https://docs.python.org/3/library/asyncio-task.html --filter "cancellation"
  → fetches full authoritative content, focused on the topic
```

## When to Use `webcrawl`

- Clean readable content from articles, docs, blog posts
- JS-rendered pages (SPAs, dynamic dashboards) — extracts the rendered **text**, not a picture
- Pages with bot-detection (crawl4ai handles this; raw curl/WebFetch will be blocked)
- Multi-step agentic navigation: fetch with `--json --links`, pick a link, repeat

Do NOT use `webcrawl` for:
- **Visual tasks** — screenshots, checking layout/styling, "view the front page", finding
  visual bugs, or looking at a local dev server/dashboard. `webcrawl` returns text only and
  **cannot see how a page looks**. Use the **web-scrape** skill (browser tools) instead.
- Raw JSON API calls — use `curl` or the relevant SDK
- File downloads (PDFs, ZIPs, binaries) — use `curl`
- Pages requiring login flows, form submission, or mouse interaction — use the **web-scrape** skill

## What NOT to Do

- Do not use `WebFetch` to retrieve web page content
- Do not use `Bash(curl <url>)` to fetch web page HTML
- Do not use `Bash(wget <url>)` for page content
- Do not use MCP crawling tools (`c4ai-sse` or similar) — the local binary is the single source of truth
- Do not attempt a fallback if `webcrawl` is missing — stop and report the issue
