---
name: web-crawl
description: Direct all web page fetching through MCP crawling tools instead of WebFetch or curl — provides JS rendering, anti-bot evasion, and structured extraction. Auto-invoke BEFORE fetching any URL, using WebFetch, scraping a page, or extracting web content. Trigger phrases: "crawl", "scrape", "fetch this URL", "get content from", "read this page", "web crawl", "extract from website", "visit this URL".
disable-model-invocation: false
---

When fetching or extracting content from any web URL, use the available MCP crawling tools — do not fall back to WebFetch or `curl` for web page content. The MCP handles JS rendering, anti-bot evasion, and produces clean LLM-ready output that raw fetches cannot.

## Available Crawl MCP Servers

**`c4ai-sse`** — crawl4ai running on VPS via SSH tunnel (port 11235)

| Tool | Use for |
|---|---|
| `md` | Fetch a URL and return clean Markdown — default choice for most tasks |
| `html` | Fetch preprocessed HTML optimised for schema extraction |
| `crawl` | Multi-URL or deep crawl (BFS/DFS across a site) |
| `execute_js` | Run JavaScript on a page before extracting content |
| `screenshot` | Capture a full-page PNG |
| `pdf` | Generate a PDF of the page |
| `ask` | Query crawl4ai's own documentation |

**Default tool:** use `md` unless the task specifically requires structured HTML, JS execution, or multi-page crawling.

## Prerequisite — SSH Tunnel

The MCP server is only reachable when the SSH tunnel is open. If MCP tools are unavailable or timing out, tell the user:

> The crawl4ai MCP requires an SSH tunnel. Open it with:
> `ssh -L 11235:localhost:11235 -N cristian@134.199.169.64`
> Then restart Claude Code or reconnect the MCP.

Do not silently fall back to WebFetch — surface the tunnel requirement so the user can fix it.

## What NOT to Do

- Do not use `WebFetch` to retrieve web page content when MCP tools are available
- Do not use `Bash(curl <url>)` to fetch web page HTML
- Do not use `Bash(wget <url>)` for page content
- WebFetch and curl are acceptable for non-page fetches (raw JSON APIs, file downloads) where crawl4ai adds no value

## Adding More Crawl MCPs in Future

When a new crawl MCP is added, update this skill's tool table and prerequisite section to include it. Until then, route all web crawling through `c4ai-sse`.
