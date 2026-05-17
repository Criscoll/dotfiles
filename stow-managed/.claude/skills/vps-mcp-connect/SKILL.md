---
name: vps-mcp-connect
description: Guide the full lifecycle of deploying any MCP server on a VPS and connecting it to Claude Code — covers Docker setup, SSH tunnel security model, claude mcp add registration, connection verification, and troubleshooting. Use when the user says "set up MCP on VPS", "connect MCP to Claude Code", "deploy MCP server", "add MCP server", "MCP not connecting", "troubleshoot MCP connection", "MCP setup".
disable-model-invocation: false
---

You are guiding the user through deploying an MCP server on a remote VPS and connecting it to Claude Code. Work through the phases below in order, pausing at each to confirm success before moving on.

## Phase 1 — Docker on the VPS

Pull and run the container. The key security default is to bind to `127.0.0.1` only — the port must never be exposed to the public internet.

```bash
docker pull <image>

docker run -d \
  -p 127.0.0.1:<port>:<port> \
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
curl http://localhost:<port>/health
```

Expected: `{"status":"ok",...}` or similar. If the server exposes no health endpoint, try `curl http://localhost:<port>/` and confirm a response.

**crawl4ai example:** image = `unclecode/crawl4ai:latest`, port = `11235`, name = `crawl4ai`, health endpoint = `/health`.

---

## Phase 2 — SSH Tunnel (Security Model)

Do not open the VPS port in the firewall. Instead, forward it locally over SSH.

**Why SSH tunnel:**
- The port stays invisible to the internet — zero public attack surface
- Works from any network (home, laptop at a café, mobile hotspot) unlike IP-based firewall rules
- Piggybacks on the SSH key auth already securing your VPS

**Open the tunnel** (run on the local machine, keep the tab open):
```bash
ssh -L <port>:localhost:<port> -N user@VPS_IP
```

`-N` means no shell — the terminal just holds the tunnel open silently. This is expected behaviour.

Once the tunnel is open, `http://localhost:<port>` on the local machine routes to the container on the VPS.

Verify from a second local tab:
```bash
curl http://localhost:<port>/health
```

Same response as above means the tunnel is working.

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
| `curl` hangs or times out | SSH tunnel not open | Run `ssh -L <port>:localhost:<port> -N user@VPS_IP` in a terminal tab |
| `Connection refused` | Container not running | `docker ps` to check; `docker start <name>` to restart |
| MCP tools missing in Claude Code | Wrong endpoint path or transport | Check server docs; try `/mcp/schema` to confirm path |
| Port already in use locally | Local port conflict | `ss -tlnp | grep <port>` to find what's using it; pick a different local forwarding port |
| `permission denied` on docker | User not in docker group | `sudo usermod -aG docker $USER && newgrp docker` |
| Tools registered but not working | Session started before registration | Restart Claude Code |

---

## Re-registration on a New Machine

1. Ensure the SSH tunnel is open: `ssh -L <port>:localhost:<port> -N user@VPS_IP`
2. Verify the container is reachable: `curl http://localhost:<port>/health`
3. Re-run `claude mcp add` with the same arguments used originally
4. Restart Claude Code

The exact commands for all active MCPs are recorded in the MCP section of `~/.claude/CLAUDE.md`.
