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
~/bin/agent_scripts/browser-start                       # Chromium (default), fresh profile
~/bin/agent_scripts/browser-start --profile             # Chromium, copy your profile (cookies, logins)
~/bin/agent_scripts/browser-start --browser firefox     # Firefox, fresh profile
~/bin/agent_scripts/browser-start --browser firefox --profile   # Firefox, copy your profile
```

Must be running before using any other tool. `browser-start` writes
`~/.cache/browser-scraping/active`, recording which browser is live; the other scripts
read it and auto-pick the right transport — **you never pass `--browser` to them.**
Profile copies go to `~/.cache/browser-scraping/{browser}/` — your real profile is never
touched.

**Chromium** is driven over CDP on `:9222`. `browser-start` finds a system Chromium/Chrome
first, then Playwright's bundled Chromium (`~/.cache/ms-playwright/`). If `webcrawl` works
on this machine, the bundled Chromium is present and will be used.

**Firefox** is driven over the WebDriver protocol via a **geckodriver** daemon on `:4444`
(a persistent WebDriver session keeps state across calls, just like the Chromium CDP
endpoint). It drives your **system Firefox** — no patched build needed. Two prerequisites:
system Firefox installed, and a `geckodriver` binary on `PATH` or at `~/opt/geckodriver`.
Install geckodriver once per machine:

```bash
curl -sSL https://github.com/mozilla/geckodriver/releases/download/v0.36.0/geckodriver-v0.36.0-linux64.tar.gz | tar xz -C ~/opt
```

> Use Firefox only when the task genuinely needs Gecko-engine rendering (e.g. a
> cross-browser visual bug comparing Gecko vs Blink). "Visual bugs", "see how it looks",
> or "take a screenshot" do NOT imply Firefox — use Chromium (the default). Only switch to
> `--browser firefox` when the user or task explicitly names Firefox or Gecko.
> One caveat: `browser-eval` runs Firefox JS synchronously (`return (expr)`) — top-level
> `await` works on Chromium but not Firefox; wrap async work in a self-calling promise if
> you need it under Firefox.

## Launching a Local Dev Server

If the task requires starting a local dev server first (e.g. `just dashboard`, `npm run dev`),
**use `nohup` and redirect output** — a bare `&` will be killed when the agent's bash
timeout fires, taking the server with it:

```bash
nohup just dashboard &>/tmp/devserver.log &
sleep 2   # give it a moment to bind its port
~/bin/agent_scripts/browser-nav http://localhost:3000
~/bin/agent_scripts/browser-screenshot
```

`nohup` detaches the process from the shell session so it survives the timeout. Without it,
the server dies mid-task and the browser gets a connection refused.

Never pipe a blocking server command through `head -N` or any other reader — `head` will
wait for N lines that may never come (the server stays running), causing an infinite hang.

## When the Browser Won't Start — STOP

If `browser-start` exits non-zero (no browser found, or CDP connection times out),
**stop and report to the user.** State the exact error and the remediation, e.g.:

> The browser scraping tools need a Chromium/Chrome browser, which isn't available here.
> Install one with `python3 -m playwright install chromium` (or a system browser), then retry.

For `--browser firefox`, the prerequisite is a `geckodriver` binary (on `PATH` or at
`~/opt/geckodriver`) plus system Firefox. If `browser-start --browser firefox` reports
geckodriver missing, install it (see the Start Browser section) and retry.

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

## Vision capability check — HARD STOP if images are unreadable

After `browser-screenshot` returns a path, read it with the Read tool. If the image does not render as visual content — you receive an error, empty output, raw binary noise, or any response other than actual image pixels you can interpret — **stop immediately** and report to the user:

> This model cannot read image files. Screenshot-based tasks require a vision-capable model (e.g. Claude Sonnet, Claude Opus). Please switch models and retry.

Do **NOT** attempt to work around this by:
- Extracting page content via `browser-eval` as a substitute for visual inspection
- Describing the page from DOM/HTML text
- Proceeding with any assumption about the visual state

A vision-capable model is a hard prerequisite for any task that requires seeing a rendered page. Surface the blocker immediately — do not spend turns improvising a text-only substitute.

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
