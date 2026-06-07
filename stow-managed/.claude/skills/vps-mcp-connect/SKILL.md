---
name: vps-mcp-connect
description: Guide the full lifecycle of deploying any MCP server on a VPS and connecting it to Claude Code — covers Docker setup, SSH tunnel security model, claude mcp add registration, connection verification, and troubleshooting. Use when the user says "set up MCP on VPS", "connect MCP to Claude Code", "deploy MCP server", "add MCP server", "MCP not connecting", "troubleshoot MCP connection", "MCP setup".
disable-model-invocation: false
---

You are guiding the user through deploying an MCP server on a remote VPS and connecting it to Claude Code. Work through the phases below in order, pausing at each to confirm success before moving on.

## Phase 0 — Find the Right Image

Before pulling anything, search for a purpose-built MCP image. Many popular tools publish one:

```bash
# web search: "<tool name> mcp docker image"
# Check Docker Hub and mcr.microsoft.com first
```

Examples:
- crawl4ai: `unclecode/crawl4ai:latest`
- Playwright: `mcr.microsoft.com/playwright/mcp` (NOT `mcr.microsoft.com/playwright` — that's the testing base image, not the MCP server)

Using the wrong base image (e.g. a testing or runtime image instead of the MCP server image) means the MCP server binary won't be present and you'll need a custom Dockerfile.

---

## Phase 1 — Docker on the VPS

Pull and run the container. The key security default is to bind to `127.0.0.1` only — the port must never be exposed to the public internet.

```bash
docker pull <image>

docker run -d \
  -p 127.0.0.1:<host-port>:<container-port> \
  --name <name> \
  --shm-size=1g \
  --restart unless-stopped \
  <image>
```

**If permission denied on `docker` commands:**
```bash
sudo usermod -aG docker $USER
newgrp docker   # take effect without re-login
```

Verify the container is up:
```bash
curl http://localhost:<host-port>/health
```

Expected: `{"status":"ok",...}` or similar. If the server exposes no health endpoint, try `curl http://localhost:<host-port>/` and confirm a response.

**Examples:**

| Server | Image | Container port | Suggested host port | Run flags |
|---|---|---|---|---|
| crawl4ai | `unclecode/crawl4ai:latest` | 11235 | 11235 | _(none extra)_ |
| Playwright | `mcr.microsoft.com/playwright/mcp` | 8931 | 3001 | `--init --entrypoint node ... /app/cli.js --headless --browser chromium --no-sandbox --port 8931 --host 0.0.0.0` |

Full Playwright example:
```bash
docker run -d \
  -p 127.0.0.1:3001:8931 \
  --name playwright-mcp \
  --init \
  --restart unless-stopped \
  mcr.microsoft.com/playwright/mcp \
  node /app/cli.js --headless --browser chromium --no-sandbox --port 8931 --host 0.0.0.0
```

---

## Phase 2 — SSH Tunnel (Security Model)

Do not open the VPS port in the firewall. Instead, forward it locally over SSH.

**Why SSH tunnel:**
- The port stays invisible to the internet — zero public attack surface
- Works from any network (home, laptop at a café, mobile hotspot) unlike IP-based firewall rules
- Piggybacks on the SSH key auth already securing your VPS

**Open the tunnel** (run on the local machine, keep the tab open):
```bash
ssh -L <local-port>:localhost:<host-port> -N user@VPS_IP
```

`-N` means no shell — the terminal just holds the tunnel open silently. This is expected behaviour.

**Critical — Host header matching:** Some MCP servers (e.g. `mcr.microsoft.com/playwright/mcp`) enforce that the HTTP `Host` header matches their internal container port. Since the `Host` header is set by the client to the local port it connects on, the **local tunnel port must match the container's internal port** — not the Docker host port.

Example: if the container runs on port 8931 but Docker maps it to host port 3001:
```bash
# WRONG — Host header will be localhost:3001, server rejects with 403
ssh -L 3001:localhost:3001 -N user@VPS_IP

# CORRECT — Host header will be localhost:8931, server accepts
ssh -L 8931:localhost:3001 -N user@VPS_IP
```

**Combining multiple MCPs into one tunnel:** Use multiple `-L` flags in a single SSH command rather than running separate tunnel processes:
```bash
ssh -L 11235:localhost:11235 -L 8931:localhost:3001 -N user@VPS_IP
```

Better still, add a named host to `~/.ssh/config` so you never have to remember the flags:
```
Host vps
    HostName <VPS_IP>
    User <username>
    LocalForward 11235 localhost:11235
    LocalForward 8931 localhost:3001
```

Then open all tunnels with: `ssh -N vps`

Once the tunnel is open, verify from a second local tab:
```bash
curl http://localhost:<local-port>/health
```

Same response as the VPS-side curl means the tunnel is working.

---

## Phase 3 — Register with Claude Code

```bash
claude mcp add --transport sse --scope user <name> http://localhost:<port>/mcp/sse
```

**Critical:** this writes to `~/.claude.json`, NOT to `settings.json`. `~/.claude.json` is machine-local and not tracked in dotfiles. On each new machine, re-run this command after opening the SSH tunnel.

Check the MCP section in `~/.claude/CLAUDE.md` for the exact re-registration commands for any MCPs already in use.

Confirm registration:
```bash
claude mcp list
```

**crawl4ai example:** `claude mcp add --transport sse --scope user c4ai-sse http://localhost:11235/mcp/sse`

Not all MCP servers use SSE transport. If the server uses stdio or WebSocket, adjust `--transport` accordingly. Check the server's docs or its `/mcp/schema` endpoint to confirm.

---

## Phase 4 — Verify MCP Tools

```bash
curl http://localhost:<port>/mcp/schema
```

This returns the list of tools the MCP server exposes. Confirm the tools you expect are present before testing from Claude Code.

Then open or restart Claude Code — MCP tools are loaded at session start. If you registered while a session was already open, restart to pick up the new server.

---

## Troubleshooting

Work through this in order:

| Symptom | Cause | Fix |
|---|---|---|
| `curl` hangs or times out | SSH tunnel not open | Run `ssh -L <local-port>:localhost:<host-port> -N user@VPS_IP` in a terminal tab |
| `Connection refused` | Container not running | `docker ps` to check; `docker start <name>` to restart |
| MCP tools missing in Claude Code | Wrong endpoint path or transport | Check server docs; try `/mcp/schema` to confirm path |
| Port already in use locally | Local port conflict | `ss -tlnp | grep <port>` to find what's using it; pick a different local forwarding port |
| `permission denied` on docker | User not in docker group | `sudo usermod -aG docker $USER && newgrp docker` |
| Tools registered but not working | Session started before registration | Restart Claude Code |
| HTTP 403 / "needs authentication" / "access only allowed at localhost:X" | Host header mismatch — local tunnel port ≠ container's internal port | Change local tunnel port to match container's internal port (see Phase 2 note above) |

---

## Re-registration on a New Machine

1. Ensure the SSH tunnel is open — prefer `ssh -N vps` if `~/.ssh/config` is set up, otherwise run the full `ssh -L ... -L ...` command
2. Verify the containers are reachable: `curl http://localhost:<local-port>/health`
3. Re-run `claude mcp add` with the same arguments used originally
4. Restart Claude Code

The exact commands for all active MCPs are recorded in the MCP section of `~/.claude/CLAUDE.md`.
