---
name: web-crawl
description: >-
  Direct all web page fetching through the local `webcrawl` binary instead of WebFetch, curl, or MCP tools — provides JS rendering, anti-bot evasion, and structured extraction. Auto-invoke BEFORE fetching any URL, using WebFetch, scraping a page, or extracting web content. Trigger phrases: "crawl", "scrape", "fetch this URL", "get content from", "read this page", "web crawl", "extract from website", "visit this URL".
disable-model-invocation: false
---

When fetching or extracting content from any web URL, use the local `webcrawl` binary. Do not use WebFetch, `curl`, MCP crawling tools, or any other fetch mechanism for web page content.

## Binary Check — Do This First

```bash
which webcrawl
```

If not found, stop and tell the user: `webcrawl` should be at `~/bin/webcrawl` via the dotfiles stow wrapper. Do not attempt any fallback.

Always confirm available flags before use — the binary may have been updated:

```bash
webcrawl --help
```

## Common Usage

```bash
webcrawl https://example.com                          # clean markdown
webcrawl https://example.com --links                  # markdown + links
webcrawl https://example.com --json                   # structured output for agents
webcrawl https://example.com --json --links           # content + navigation in one shot
webcrawl https://example.com --filter "topic"         # BM25-scored, topic-focused
```

**Agentic navigation pattern:** fetch with `--json --links`, read `links.internal` to pick the next URL, repeat.

**Research pattern:** `WebSearch` to find URLs → `webcrawl` to fetch full content of the best hits.

## When to Use / Not Use

Use `webcrawl` for: articles, docs, blog posts, JS-rendered SPAs, pages with bot-detection.

Do NOT use for:
- **Visual tasks** (screenshots, layout checks, local dev servers) → use **web-scrape** skill instead
- Raw JSON API calls → use `curl`
- File downloads (PDFs, ZIPs) → use `curl`
- Login flows, form submission, mouse interaction → use **web-scrape** skill

Never fall back to `WebFetch`, `curl`, `wget`, or MCP crawling tools for page content.

## Site-Specific Notes

Check the relevant file before crawling these sites — they have known restrictions, preferred strategies, or non-obvious gotchas that will save a failed attempt.

| You need to… | Context | Read |
|---|---|---|
| Crawl Reddit posts, comments, or subreddits | Access is heavily restricted; most paths are blocked without credentials; RSS and Playwright behave differently | [`reddit.md`](reddit.md) |
