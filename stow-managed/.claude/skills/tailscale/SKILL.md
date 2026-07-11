---
name: tailscale
description: >-
  Standardize how Cristian uses Tailscale — exposing Docker-hosted apps over
  the tailnet via loopback binding + `tailscale serve` TLS termination, and
  the Mullvad CGNAT-bypass mechanism for reaching tailnet peers while a VPN is
  active. Auto-invoke BEFORE running any `tailscale serve`/`tailscale
  funnel`/`tailscale up` command, binding a Docker container's port for
  tailnet access, deploying or exposing an app on a Tailscale-connected host,
  or diagnosing "can't reach a Tailscale peer" while a VPN is running. Trigger
  phrases: "tailscale serve", "tailscale funnel", "expose on tailscale",
  "expose over tailnet", "tailnet", "MagicDNS", "tailscale ip", "tailscale
  status", "host on the VPS", "docker on the vps", "sploomvps", "can't reach
  tailscale peer", "mullvad tailscale", "CGNAT", "100.64".
disable-model-invocation: false
---

Cristian uses Tailscale for two distinct jobs: (1) turning a Docker-hosted app
into a clean HTTPS tailnet endpoint, and (2) keeping tailnet reachability
working on a machine that also runs Mullvad. Figure out which job applies,
then load the matching reference.

## Step 0 — confirm which device this is

Every instruction below is device-specific — a command that's correct on the
VPS is meaningless (or wrong) on a laptop, and vice versa. Don't assume;
check:

```bash
tailscale status   # shows this device's own entry (marked with the hostname) plus all peers
hostname
```

Compare the hostname against the table in `references/hosting-apps.md`. If
the device isn't in that table and it's unclear whether it's meant to host
apps or just act as a client, **ask the user** rather than guessing — adding
a `tailscale serve` mapping on the wrong box, or assuming VPN-bypass rules
exist on a machine that doesn't have them, both fail in confusing ways later.

## Step 1 — pick the reference

- **Exposing or deploying an app** (Docker container that other tailnet
  devices — phone, laptop — need to reach over clean HTTPS): read
  `references/hosting-apps.md`. Covers the loopback-bind + `tailscale serve`
  pattern, the one-hostname-many-ports model, and the current inventory of
  what's already exposed on the VPS.
- **Tailscale peer unreachable while a VPN (Mullvad) is active on this
  machine**, or setting up that bypass on a new machine: read
  `references/mullvad-cgnat-bypass.md`. Covers the two-mark nftables
  mechanism and the one-line recovery command.

Read the relevant file with the Bash tool
(`cat "$CLAUDE_SKILL_DIR/references/<file>"`) rather than guessing its
contents — both carry exact commands, ports, and hostnames that matter.

## Cross-cutting rules

- **Never bind an app's container port to a public or tailnet-facing
  interface.** Bind to `127.0.0.1:<port>` and let `tailscale serve` do TLS
  termination and tailnet exposure. This is true for every app on the VPS,
  not just the ones already documented — apply it to new services by
  default.
- **Don't assume a Host header.** Once traffic arrives via `tailscale serve`,
  the backend sees `Host: localhost:<port>`, not the tailnet IP or MagicDNS
  hostname a naive config might expect. If an app validates the Host header
  or CORS origin, verify the actual value with `curl -v` against the live
  `tailscale serve` endpoint before hardcoding a hostname allowlist.
- **Funnel is policy-disabled on this tailnet** — don't propose it as a way
  to get a public URL. Tailnet-only exposure via `tailscale serve` is the
  only supported path here.
- A Tailscale node has exactly one MagicDNS hostname. Multiple apps on the
  same host share that hostname and differentiate by port
  (`https://<hostname>:443`, `:8443`, …) — there's no per-app subdomain
  without a second node.

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`).
Do not guess their contents — read them.

- **references/hosting-apps.md** — load when: exposing a new app, adding a
  second `tailscale serve` mapping, or checking what's already running on a
  hosting device.
- **references/mullvad-cgnat-bypass.md** — load when: a Tailscale peer is
  unreachable on a machine also running Mullvad, or setting up the bypass on
  a new machine.
