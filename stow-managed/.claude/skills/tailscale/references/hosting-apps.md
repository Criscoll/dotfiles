# Hosting apps over the tailnet via `tailscale serve`

## The pattern

Every app gets exposed the same way, regardless of what it is:

1. The app's container/process binds to `127.0.0.1:<port>` — loopback only,
   never the tailnet interface (`tailscale0`) or a public interface.
2. `tailscale serve` fronts it, handling TLS termination and tailnet-only
   exposure:
   ```bash
   sudo tailscale serve --bg --https=<external-port> http://localhost:<port>
   ```
3. Verify the mapping:
   ```bash
   tailscale serve status
   ```

This is the same shape whether the app is a single container, a Docker
Compose stack, or a bare process — `tailscale serve`'s target is just a
`localhost` URL, it doesn't care what's behind it.

**Why loopback, not the Tailscale IP directly:** binding straight to the
tailnet IP (`TS_IP:<port>:<port>`) technically works — any tailnet peer can
reach it — but leaves the app on a raw `http://` URL with an exposed port. It
also means the app has no TLS, and adding a second app means juggling
multiple raw IP:port addresses. Routing everything through `tailscale serve`
gives every app a clean `https://` URL under the same hostname and centralizes
TLS in one place.

## One hostname, many ports

A Tailscale node has exactly **one** MagicDNS hostname
(`<node>.<tailnet>.ts.net`). There's no per-app subdomain without standing up
a second node or enabling Funnel — and Funnel is policy-disabled on this
tailnet, so it isn't an option here. The supported way to front more than one
local service on the same node is multiple `tailscale serve` rules on
different ports:

```bash
tailscale serve status
# https://sploomvps.tailba1ff4.ts.net (tailnet only)
# |-- /:443   proxy http://127.0.0.1:8080   (finance app)
# |-- /:8443  proxy http://127.0.0.1:6767   (paseo)
```

Adding a new app means picking an unused external port and adding one more
`--https=<port>` mapping — existing mappings are untouched.

## The Host-header gotcha

Once traffic arrives via `tailscale serve`, the backend sees whatever Host
header the *proxy* sends, which is the `localhost:<port>` target — not the
tailnet IP and not the MagicDNS hostname the client actually connected to. If
the app validates the Host header (Paseo's `PASEO_HOSTNAMES`) or checks CORS
origins, don't assume which value it needs ahead of time. After the mapping
is live, confirm with a real request:

```bash
curl -v https://<hostname>.ts.net:<external-port>/health
# or check the app's own request logs
```

Then set the app's host/origin allowlist to match what was actually
observed. This mirrors the same class of bug documented in
`vps-mcp-connect`'s Phase 2 (SSH-tunnel local-port-must-match-container-port
Host header mismatch) — different transport, same underlying lesson: proxies
change what Host header the backend sees, don't assume it matches the
client-facing address.

## Known hosting devices

Extend this table as new devices take on an app-hosting role.

| Hostname | Tailnet | IP | Role | Notes |
|---|---|---|---|---|
| `sploomvps` | `tailba1ff4` | `134.199.169.64` | Primary VPS — hosts Docker apps exposed via `tailscale serve` | Funnel policy-disabled on this tailnet |

## Current `tailscale serve` inventory on `sploomvps`

Keep this in sync when mappings change — it's the fastest way to know what
port is free before adding a new app.

| External port | Backend | App | Notes |
|---|---|---|---|
| `:443` | `http://127.0.0.1:8080` | Financial spreadsheets app | Caddy container bound to loopback |
| `:8443` | `http://127.0.0.1:6767` | Paseo (remote code-harness UI) | See `Project_LLM_Web_App/outline.md` in scribbles for the full deployment checklist |

## Adding a new app — checklist

1. Confirm you're on the hosting device (Step 0 in `SKILL.md`).
2. Pick an unused external port (check the inventory table above and/or
   `tailscale serve status`).
3. Bind the app to `127.0.0.1:<internal-port>` in its compose file / run
   command — never the tailnet IP.
4. `sudo tailscale serve --bg --https=<external-port> http://localhost:<internal-port>`
5. `tailscale serve status` — confirm the new mapping sits alongside existing
   ones without conflict.
6. If the app does Host/CORS validation, verify the real Host header (see
   above) before setting its allowlist.
7. Update the inventory table in this file with the new mapping.
