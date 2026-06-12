---
name: playwright
description: >-
  Use the Playwright MCP for browser automation, UI testing, and interacting with web apps — covers available tools, when to use vs crawl4ai, and the relay chain required to reach a local dev server from inside Docker. Trigger phrases: "playwright", "browser automation", "click on", "fill in the form", "take a screenshot of the app", "test the UI", "navigate to the app", "interact with the page", "check if the button works".
disable-model-invocation: false
---

The `playwright` MCP runs a headless Chromium browser inside a Docker container on the VPS. Use it when you need to interact with a web page (click, type, evaluate JS, take screenshots of live state) rather than just extract content.

## When to Use Playwright vs crawl4ai

| Situation | Use |
|---|---|
| Read an article / docs page | crawl4ai `md` |
| Extract structured data from a static page | crawl4ai `html` |
| Click buttons, fill forms, navigate flows | Playwright |
| Screenshot a live app (not just a static page) | Playwright |
| Run JS in context of a live page session | Playwright |
| Login flows, auth-gated content | Playwright |
| Test that a UI feature actually works | Playwright |

## Playwright MCP Tools

| Tool | Use for |
|---|---|
| `browser_navigate` | Go to a URL |
| `browser_screenshot` | Capture the current page as PNG |
| `browser_click` | Click an element (by selector or coordinates) |
| `browser_type` | Type text into an input |
| `browser_evaluate` | Run JavaScript in the page context |
| `browser_wait_for` | Wait for an element or condition |
| `browser_select_option` | Select from a `<select>` dropdown |
| `browser_check` / `browser_uncheck` | Toggle checkboxes |
| `browser_hover` | Hover over an element |
| `browser_scroll` | Scroll the page |
| `browser_go_back` / `browser_go_forward` | Navigate browser history |
| `browser_close` | Close the current page |

Always start with `browser_screenshot` after navigating to confirm the page loaded correctly before interacting.

## Prerequisite — SSH Tunnel

The Playwright MCP requires an SSH tunnel open locally:
```bash
ssh -L 8931:localhost:3001 -N cristian@134.199.169.64
```

Note: local port **8931** → VPS host port **3001** (not 8931→8931). The server enforces a `Host: localhost:8931` header check and will reject requests arriving as `localhost:3001`.

If tools are unavailable or you get 403s, tell the user to open the tunnel above and restart Claude Code.

---

## Reaching a Local Dev Server (Relay Chain)

The Playwright browser runs inside Docker on the VPS. `localhost` inside the container is the container itself — NOT the user's local machine. To reach a dev server running locally (e.g. marimo, a Next.js app, anything on `localhost:<port>`), you need a relay chain.

### Full Relay Chain

```
[Playwright browser, inside Docker]
        ↓ connects to localhost:2719
[Node TCP relay inside Docker container]
        ↓ forwards to 172.17.0.1:2719   (Docker bridge IP = VPS host)
[Python TCP relay on VPS host, bound to 172.17.0.1:2719]
        ↓ forwards to 127.0.0.1:2718
[SSH reverse tunnel endpoint on VPS]
        ↓ forwarded back over SSH to
[Local dev server, localhost:2718]
```

Port conventions (adjust as needed — keep the chain consistent):
- **2718** — local dev server port + SSH reverse tunnel endpoint on VPS
- **2719** — VPS Python relay (on Docker bridge IP) + Node relay inside Docker

### Why Not Just Use a Single SSH Tunnel?

The SSH reverse tunnel binds to `127.0.0.1` on the VPS. The Docker bridge IP `172.17.0.1` is a separate interface — containers can reach it, but they can't reach `127.0.0.1` on the VPS host directly. The Python relay bridges from the Docker-visible IP to the loopback SSH endpoint.

The Node relay inside Docker ensures the browser sees `http://localhost:2719` as the origin. This matters because **service workers and lazy-loaded JS chunks require a `localhost` or HTTPS origin** — navigating to `172.17.0.1:2719` directly would cause service worker registration failures and 404s on dynamic assets.

### Setting Up the Relay Chain (Step by Step)

**Step 1 — Start the local dev server**
```bash
# Example: marimo app
uv run --group app marimo run app/dashboard.py --port 2718 --no-token --headless &
# --no-token avoids auth challenges through the relay
```

**Step 2 — SSH reverse tunnel (local → VPS)**

Run on the local machine:
```bash
ssh -R 2718:localhost:2718 -N -f -o StrictHostKeyChecking=no -o BatchMode=yes cristian@134.199.169.64
```

This makes `127.0.0.1:2718` on the VPS forward back to `localhost:2718` locally.

Verify:
```bash
ps aux | grep "ssh.*-R.*2718"
```

**Step 3 — Python TCP relay on VPS (Docker bridge → SSH tunnel)**

```bash
ssh cristian@134.199.169.64 "python3 - << 'EOF' &
import socket, threading

def handle(client):
    try:
        srv = socket.create_connection(('127.0.0.1', 2718))
        def pipe(a, b):
            try:
                while True:
                    d = a.recv(65536)
                    if not d: break
                    b.sendall(d)
            except: pass
            finally:
                try: b.shutdown(socket.SHUT_WR)
                except: pass
        threading.Thread(target=pipe, args=(client, srv), daemon=True).start()
        threading.Thread(target=pipe, args=(srv, client), daemon=True).start()
    except Exception as e:
        client.close()

s = socket.socket()
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('172.17.0.1', 2719))
s.listen(50)
while True:
    c, _ = s.accept()
    threading.Thread(target=handle, args=(c,), daemon=True).start()
EOF
"
```

Note: `socat` is NOT installed on the VPS — use this Python relay.

Verify:
```bash
ssh cristian@134.199.169.64 "ss -tlnp | grep 2719"
# Should show: LISTEN 172.17.0.1:2719
```

**Step 4 — Node TCP relay inside Docker**

```bash
ssh cristian@134.199.169.64 "docker exec -d playwright-mcp node -e \"
const net = require('net');
net.createServer(c => {
  const b = net.connect(2719, '172.17.0.1');
  c.pipe(b); b.pipe(c);
  c.on('error', ()=>b.destroy()); b.on('error', ()=>c.destroy());
}).listen(2719, '127.0.0.1');
\""
```

`EADDRINUSE` means it's already running — that's fine.

**Step 5 — Verify the full chain**

```bash
ssh cristian@134.199.169.64 "docker exec playwright-mcp node -e \"
const http = require('http');
http.get('http://localhost:2719/', r => {
  console.log('status:', r.statusCode);
  r.resume();
}).on('error', e => console.log('error:', e.message));
\""
# Should print: status: 200
```

**Step 6 — Navigate with Playwright**

```
browser_navigate: http://localhost:2719/
```

### Session Persistence — Relay Processes Do NOT Survive

Relay processes are ephemeral. At the start of any session where you need to reach a local dev server, check each leg:

```bash
# 1. SSH reverse tunnel (local)
ps aux | grep "ssh.*-R.*2718"

# 2. VPS Python relay
ssh cristian@134.199.169.64 "ss -tlnp | grep 2719"

# 3. Docker Node relay
ssh cristian@134.199.169.64 "docker exec playwright-mcp ss -tlnp 2>/dev/null | grep 2719"
```

The SSH reverse tunnel (step 2) often survives across sessions. The Python relay on VPS may or may not be running. The Node relay inside Docker is the most likely to be gone if the container restarted.

Re-run any missing steps before attempting to navigate.
