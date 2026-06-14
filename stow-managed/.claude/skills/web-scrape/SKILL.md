---
name: web-scrape
description: >-
  Stateful interactive browser control AND the only way to see how a page actually
  renders — screenshots, visual inspection, visual-bug hunting. Use for tasks that need
  login sessions, JS interaction, form submission, or a real rendered view. Auto-invoke
  BEFORE tasks like: "view the front page", "are there visual bugs", "see how it looks",
  "take a screenshot", "view the app / dashboard / local dev server", "log in and scrape",
  "click on", "scrape with authentication", "navigate and extract", "interactive scrape",
  "fill in the form", "submit and capture", "scrape behind login".
disable-model-invocation: false
---

# Browser Scraping Tools

Stateful browser control via CDP. Scripts live in `~/bin/agent_scripts/`. A browser
started with `browser-start` stays running between calls — session state (cookies,
navigation) persists.

## Start Browser

```bash
~/bin/agent_scripts/browser-start                   # fresh Chromium profile
~/bin/agent_scripts/browser-start --profile         # copy your Chromium profile (cookies, logins)
```

> **Chromium only.** These tools drive the browser over CDP (Chrome DevTools Protocol).
> Firefox removed CDP (BiDi-only since FF 129+), so `--browser firefox` fails fast — it
> cannot be driven this way. There is **no Firefox support yet**: don't try to launch
> Firefox manually or screenshot it via other means as a workaround. If a task genuinely
> needs Firefox-engine rendering (e.g. a cross-browser visual bug), say so and stop —
> proper Firefox support is a TODO (Playwright-native Firefox over WebDriver BiDi).

Starts the browser on `:9222`. Must be running before using any other tool.
Profile is copied to `~/.cache/browser-scraping/{browser}/` — your real profile is never modified.

`browser-start` finds a browser automatically: a system Chromium/Chrome first, then
Playwright's bundled Chromium (`~/.cache/ms-playwright/`). If `webcrawl` works on this
machine, the bundled Chromium is present and `browser-start` will use it.

## When the Browser Won't Start — STOP

If `browser-start` exits non-zero (no browser found, or CDP connection times out),
**stop and report to the user.** State the exact error and the remediation, e.g.:

> The browser scraping tools need a Chromium/Chrome browser, which isn't available here.
> Install one with `python3 -m playwright install chromium` (or a system browser), then retry.

Do **NOT** improvise a workaround. In particular, do not:

- `curl`/`wget` the target's HTML or hit its REST/internal API to reconstruct the page
- reverse-engineer app endpoints, auth tokens, kernel/websocket APIs, or static-export tricks
- substitute an unrelated screenshot/render mechanism

A working browser is a hard prerequisite. These detours burn many turns and still don't
produce the rendered view the task needs — surface the blocker and let the user fix it.
A one-line "I can't do this without a browser, here's how to enable it" beats twenty turns
of flailing.

## Navigate

```bash
~/bin/agent_scripts/browser-nav https://example.com        # current tab
~/bin/agent_scripts/browser-nav https://example.com --new  # open new tab
```

## Evaluate JavaScript

```bash
~/bin/agent_scripts/browser-eval 'document.title'
~/bin/agent_scripts/browser-eval 'document.querySelectorAll("a").length'
~/bin/agent_scripts/browser-eval 'Array.from(document.querySelectorAll(".item")).map(el => ({ text: el.textContent.trim(), href: el.href }))'
```

Runs in the active tab's page context. Full DOM API available. Async is supported —
wrap in `async () =>` if needed, or use top-level await expressions.

## Screenshot

```bash
~/bin/agent_scripts/browser-screenshot
```

Captures the active tab's viewport. Prints a temp file path — use the Read tool to view the image.

## Pick Elements (requires user interaction)

```bash
~/bin/agent_scripts/browser-pick "Click the product price element"
```

Shows a blue highlight overlay in the browser window. The user clicks to select an element
(Ctrl+click for multi-select, Enter to confirm, Esc to cancel). Returns for each element:
`tag`, `id`, `class`, `text` (first 200 chars), `html` (first 500 chars), `parents` (ancestor chain).

Use this when you need the user to point out DOM elements instead of hunting through the HTML yourself.

## Typical Workflow

```bash
# 1. Start browser with profile (for authenticated scraping)
~/bin/agent_scripts/browser-start --profile

# 2. Navigate to target
~/bin/agent_scripts/browser-nav https://example.com/dashboard

# 3. Screenshot to see current state
~/bin/agent_scripts/browser-screenshot   # → /tmp/screenshot-20250614-143022.png

# 4. Extract data via JS
~/bin/agent_scripts/browser-eval 'Array.from(document.querySelectorAll(".row")).map(r => r.textContent.trim())'

# 5. Have user identify an element
~/bin/agent_scripts/browser-pick "Click the export button"
```

## vs web-crawl

| | `webcrawl` | browser scraping tools |
|---|---|---|
| Session state | Stateless (fresh browser each call) | Stateful (browser stays running) |
| Auth / cookies | No | Yes — via `--profile` or manual login |
| JS interaction | No | Yes — `browser-eval`, `browser-pick` |
| Content filtering | Yes (BM25/pruning) | No — extract via JS |
| **Screenshots / visual view** | **No — text only** | **Yes — `browser-screenshot`** |
| Best for | Reading articles, docs, public pages | Authenticated scraping, interactive extraction, **anything visual** |

Use `webcrawl` for simple public page reads (it returns text/markdown only). Use these
tools when you need a session **or when the task is visual** — viewing a rendered page,
checking layout/styling, finding visual bugs, or looking at a local dev server/dashboard.
`webcrawl` cannot see how a page *looks*; only a screenshot can.
