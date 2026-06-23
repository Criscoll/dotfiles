---
name: browser-inspect
description: >-
  Stateful interactive browser control AND the only way to see how a page actually
  renders — screenshots, visual inspection, visual-bug hunting. Use for tasks that need
  login sessions, JS interaction, form submission, or a real rendered view. Auto-invoke
  BEFORE tasks like: "view the front page", "are there visual bugs", "see how it looks",
  "take a screenshot", "view the app / dashboard / local dev server", "log in and scrape",
  "click on", "inspect the rendered UI", "navigate and extract", "interactive browser",
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
> One caveat: `browser-eval` runs Firefox JS synchronously — top-level `await` works on
> Chromium but not Firefox; wrap async work in a self-calling promise if you need it under
> Firefox. Multi-statement and `let`/`const` blocks **do** work on both (see Evaluate
> JavaScript below).

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
# Multi-statement block — end with an explicit `return` (works on both browsers):
~/bin/agent_scripts/browser-eval 'let t = document.querySelector(".total"); return t ? t.textContent.trim() : null;'
```

Runs in the active tab's page context. Full DOM API available. Pass **either** a single
expression **or** a statement block ending in an explicit `return` — `let`/`const` and
multi-line code both work on Chromium and Firefox. (Internally an expression is tried
first; on a `SyntaxError` it's re-run as a function body, so a statement block needs its
own `return`.) Async: wrap in `async () =>` on Chromium; under Firefox use a self-calling
promise. Don't reach for `browser-html`/`browser-click`/`browser-scroll` reflexively when a
one-line eval does the job — but those exist for the cases below.

## Screenshot

```bash
~/bin/agent_scripts/browser-screenshot
~/bin/agent_scripts/browser-screenshot --full-page   # whole document (Chromium only)
```

Captures the active tab's viewport. Prints a temp file path — use the Read tool to view the image.

`--full-page` captures the entire scrollable document in one image (Chromium only). It
measures the **document's** scroll height, so it does **not** capture apps that scroll an
inner container (Marimo, chat UIs, dashboards with a fixed shell). For those, use
`browser-scroll` between viewport screenshots — see below.

## Vision capability check — delegate if images are unreadable

After `browser-screenshot` returns a path, read it with the Read tool. If the image does not render as visual content — you receive an error, empty output, raw binary noise, or any response other than actual image pixels you can interpret — **delegate to a vision-capable model via `vision-read`:**

```bash
SCREENSHOT=$(~/bin/agent_scripts/browser-screenshot)
~/bin/agent_scripts/vision-read "$SCREENSHOT" 'context for what to look for'
```

`vision-read` sends the screenshot to pi running a vision-capable model (Kimi K2.6 by default), which returns a detailed text description. Use the description to continue the task.

Provide context to prime the model for what matters:

```bash
~/bin/agent_scripts/vision-read "$SCREENSHOT" 'Inspecting for visual bugs — misalignment, overlapping elements, broken images, color inconsistencies'
~/bin/agent_scripts/vision-read "$SCREENSHOT" 'Extract all data values and numbers shown in the charts and tables'
~/bin/agent_scripts/vision-read "$SCREENSHOT" 'Describe the page layout and UI structure'
```

Override the model or thinking level if needed:

```bash
~/bin/agent_scripts/vision-read --model opus --thinking medium "$SCREENSHOT" 'Analyze design quality'
```

Do **NOT** attempt to work around this by:
- Extracting page content via `browser-eval` as a substitute for visual inspection
- Describing the page from DOM/HTML text
- Proceeding with any assumption about the visual state

## Visual Bug Diagnostic Loop

After spotting a broken element in a screenshot, before guessing the cause from code:

1. Read the rendered value directly:
   ```bash
   ~/bin/agent_scripts/browser-eval 'Array.from(document.querySelectorAll(".delta")).map(el => el.textContent.trim())'
   ```
   Scope to the broken component's CSS class to extract the actual rendered string.

2. Check for runtime JS errors:
   ```bash
   ~/bin/agent_scripts/browser-eval 'window.__sveltekit_error ?? null'
   ```

3. Confirm the fixed value after each change before re-screenshotting — saves a round trip:
   ```bash
   ~/bin/agent_scripts/browser-nav http://localhost:5173/overview  # reload
   ~/bin/agent_scripts/browser-eval 'document.querySelector(".delta").textContent'
   ```

4. Only take a final screenshot once the eval confirms the value is correct.

## Inspect the DOM

```bash
~/bin/agent_scripts/browser-html               # whole document outerHTML
~/bin/agent_scripts/browser-html ".tabbar"     # scope to one subtree
~/bin/agent_scripts/browser-html "#app" --max 4000   # cap output length
```

Dumps the **rendered** `outerHTML` of the active tab (or one CSS-selected subtree). Reach
for this when a control isn't a standard element and you can't guess its selector — read
the real markup instead of hunting blind through `browser-eval`. Scope with a selector
(and `--max`) to avoid dumping a huge SPA tree.

## Click an Element

```bash
~/bin/agent_scripts/browser-click --text "Spending"        # by visible label
~/bin/agent_scripts/browser-click --selector "button.export"  # by CSS selector
```

Native click (real pointer events), so it works on custom controls — framework tabs,
`role=button` divs — that a raw JS `.click()` misses. Prefer `--text` for anything a human
would click by its label (tabs, buttons). This is the autonomous way to drive tabs/menus —
don't fall back to `browser-pick` (which needs the user to physically click) unless the
text/selector approach genuinely can't target the element.

Does **not** penetrate Shadow DOM — if `browser-click` reports `✗ No element found` for a
control you can clearly see (especially under Firefox), the element likely lives inside a
custom element's shadow tree. See "Click inside Shadow DOM" below.

## Click inside Shadow DOM / Web Components

```bash
~/bin/agent_scripts/browser-click-shadow MARIMO-TABS Spending        # click "Spending" tab
~/bin/agent_scripts/browser-click-shadow MARIMO-TABS "Net Worth"     # multi-word label
~/bin/agent_scripts/browser-click-shadow --selector "button[role=tab]" MARIMO-TABS "Net Worth"
```

`browser-click` can't reach elements inside the shadow root of a custom element
(`<marimo-tabs>`, Radix, Lit, Shoelace — any modern design system). `browser-click-shadow`
takes the host tag name plus a visible label: it finds the host, searches its `shadowRoot`
for a tab/button/link matching the text (override the candidate set with `--selector`), and
fires the full `focus()` + `click()` + `MouseEvent` sequence that SPA frameworks need (a
bare `.click()` is often ignored). Works on both Chromium and Firefox.

If you're unsure of the host tag, dump the markup with `browser-html` and look for an
unfamiliar custom element (a tag with a hyphen) wrapping the control.

## Reactive / server-side apps

In marimo, Streamlit, Shiny, and similar apps, a click triggers a backend recomputation —
the DOM won't update instantly (it arrives over a websocket after a Python roundtrip).
After any click or form interaction, wait 2–4 seconds before the next screenshot or eval:

```bash
~/bin/agent_scripts/browser-click-shadow MARIMO-TABS "Spending"
sleep 3
~/bin/agent_scripts/browser-screenshot
```

## Scroll (incl. inner containers)

```bash
~/bin/agent_scripts/browser-scroll                 # down ~one viewport
~/bin/agent_scripts/browser-scroll --to bottom      # jump to the end
~/bin/agent_scripts/browser-scroll --to top         # back to the start
~/bin/agent_scripts/browser-scroll --by 1200        # down N pixels
~/bin/agent_scripts/browser-scroll --selector "#main"  # a specific container
```

`window.scrollTo` does nothing in many apps (Marimo, chat UIs, dashboards) because the
content scrolls an **inner** element, not the window. `browser-scroll` finds the deepest
scrollable container and scrolls *that*, and reports the new position (`scrollTop/max`, and
`(at bottom)` when you've reached the end). To inspect a long page visually, loop:
`browser-scroll` → `browser-screenshot` → Read, until it reports `(at bottom)`.

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

# 4. Switch a tab / drive the UI, then re-screenshot
~/bin/agent_scripts/browser-click --text "Spending"
~/bin/agent_scripts/browser-screenshot

# 5. Inspect content below the fold (inner-scroller apps)
~/bin/agent_scripts/browser-scroll --by 800
~/bin/agent_scripts/browser-screenshot

# 6. Extract data via JS
~/bin/agent_scripts/browser-eval 'Array.from(document.querySelectorAll(".row")).map(r => r.textContent.trim())'

# 7. Stuck on an odd control? Read its markup, or have the user point it out
~/bin/agent_scripts/browser-html ".weird-widget"
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
