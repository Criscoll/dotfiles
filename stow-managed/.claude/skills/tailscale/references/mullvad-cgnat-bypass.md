# Mullvad + Tailscale: reaching a CGNAT peer while the VPN is active

Full mechanism, history, and reasoning are settled in
`docs/tailscale-mullvad-routing-2026-06-25.md` at the dotfiles repo root —
read that file for the *why*. This file is the condensed operational version
for diagnosing and fixing the symptom quickly.

## Symptom

On a machine running both Tailscale and Mullvad, a Tailscale CGNAT peer
(`100.64.0.0/10` — e.g. the VPS) becomes unreachable over normal traffic
while Mullvad is connected.

**The tell:** `tailscale ping <peer>` still succeeds (it uses Tailscale's
public relay, bypassing the kernel routing stack entirely), but `curl`, `ssh`,
or anything else routed normally fails. That contrast — relay works, kernel
path doesn't — means Mullvad's policy routing is sending the traffic down
`wg0-mullvad`, and its nftables kill-switch is rejecting it because it never
reaches the tunnel as CGNAT traffic.

## Why it happens (one paragraph)

Mullvad's kill-switch only accepts packets carrying its own conntrack mark
(`0x00000f41`), and its routing rule (`5204`) unconditionally sends
non-Mullvad traffic into its own table unless the packet also carries a
specific fwmark (`0x6d6f6c65`, "mole" in ASCII) that makes rule 5204 skip it
and fall through to Tailscale's own routing rule (`5270`). Fixing this means
setting *both* marks in a `type route hook output` nftables chain at priority
`-100` (must be `type route`, not `type filter`, because only a route-hook
chain can influence the routing decision before Mullvad's reject chain at
priority `0`).

## Fix / diagnose

The mechanism is implemented as a systemd unit + nftables table, applied once
at boot, in `system/` in the dotfiles repo (install + diagnose scripts). It's
designed to survive Mullvad reconnects untouched — Mullvad's own docs say
it's safe to leave these rules set indefinitely.

If the peer is unreachable and this bypass should already be active on this
machine:

```bash
# One-line recovery — idempotent, safe to re-run
sudo systemctl restart tailscale-mullvad-bypass.service

# Confirm state
bash system/diagnose-tailscale-mullvad.sh   # from the dotfiles repo root
```

If this machine has never had the bypass installed (new machine, or a
machine that runs both Tailscale and Mullvad for the first time), install it
from `system/` per that directory's own install script — don't hand-roll the
nft rules from this summary; the full doc has the exact chain definitions and
the priority-window reasoning that makes it robust to Mullvad updating its
own rule numbers.

## Portability note

The systemd unit hardcodes `/usr/sbin/nft`, which is valid on usrmerged
distros (Debian/Ubuntu/Pop/Arch). If applying this on a different distro
family, check the binary path first.
