# Tailscale + Mullvad: Routing CGNAT Traffic Around the VPN (2026-06-25)

**Status:** settled. This is the authoritative writeup of the mechanism. Implementation
lives in `system/` (install + diagnose scripts, nft table, systemd unit).

## Problem

On a machine running Tailscale and Mullvad VPN simultaneously, reaching a Tailscale
CGNAT peer (`100.64.0.0/10`) fails while Mullvad is active. Mullvad's policy routing
sends the traffic down `wg0-mullvad`, and its nftables kill-switch `reject`s anything
not leaving via the tunnel. `tailscale ping <peer>` still works (it uses the public
relay, bypassing the kernel routing stack) — that contrast is the smoking gun: the
relay path is fine, the kernel path is blocked.

## The mechanism — two marks, one chain

Mullvad officially documents this
([split-tunneling-with-linux-advanced](https://mullvad.net/en/help/split-tunneling-with-linux-advanced#allow-ip)).
Excluding traffic requires setting **two marks** in a `type route hook output` chain:

| Mark | Value | Effect |
|---|---|---|
| `ct mark` | `0x00000f41` | Matched by Mullvad's `ct mark 0x00000f41 accept` kill-switch rule → packet passes the firewall. |
| `meta mark` | `0x6d6f6c65` | "Used not only by the firewall, but also by the routing table." Mullvad's policy rule 5204 (`not from all fwmark 0x6d6f6c65 lookup 1836018789`) **skips** marked packets, so they fall through to Tailscale's rule 5270 (`lookup 52`) and route via `tailscale0`. |

The `meta mark` is what removes the need for any custom `ip rule`: instead of inserting
our own rule at a hand-tuned priority to win a race against Mullvad's 5204, we make 5204
*decline to match* our packet. The chain must be `type route` (not `type filter`) because
only a route-hook chain can influence the routing decision. Priority must be in
`-200..0` (Mullvad's reject chain is at priority 0); we use `-100`.

The same two marks are also set on inbound traffic (`ip saddr 100.64.0.0/10`, in a
`type filter hook input` chain) so other devices can initiate connections *to* this host
over Tailscale, not just receive replies.

Mullvad's docs state it is "safe to leave these rules set indefinitely, even when the
app is disconnected" — officially supported and future-proof. Confirmed independently by
<https://theorangeone.net/posts/tailscale-mullvad/>, which uses exactly this approach.

## The journey: over-engineered → simplified

An earlier session solved the same problem with a fragile two-layer fix:

1. **Layer 1 — `ip rule 5200`:** a policy rule `to 100.64.0.0/10 lookup 52` inserted at
   priority 5200 (before Mullvad's 5204) to force CGNAT traffic into Tailscale's table.
   This needed a bespoke systemd "routing" service to win a priority race against Mullvad
   and was inherently fragile — if Mullvad re-asserted its rules at a lower priority, the
   fix silently broke.
2. **Layer 2 — single `ct mark`** in a `type filter` chain. A filter chain can pass the
   kill-switch but cannot affect routing, which is *why* Layer 1 was needed at all.

Setting **both marks** in a **`type route`** chain collapses both layers into one file
with no `ip rule` and no priority race — the previous design's core weakness. The
mechanism is independent of Mullvad's own table numbers and rule priorities.

## Reference values

- Mullvad split-tunnel conntrack mark: `0x00000f41`
- Mullvad fwmark for VPN-traversed traffic: `0x6d6f6c65` ("mole" in ASCII)
- Mullvad policy rules: `5203` (main suppress), `5204` (catch-all → VPN table `1836018789`)
- Tailscale policy rule: `5270` (`lookup 52`); table 52 holds the `dev tailscale0` routes
- Our nft chains run at priority `-100` (window `-200..0`, before Mullvad's reject at 0)

## Residual risk

The marks are applied once at boot by the systemd unit, independent of Mullvad's
table/priorities, and Mullvad documents leaving them set permanently — so reconnects
shouldn't disturb them. If ever wiped mid-session, recovery is one idempotent command:
`sudo systemctl restart tailscale-mullvad-bypass.service`. The diagnostics script
(`system/diagnose-tailscale-mullvad.sh`) makes confirming or restoring state trivial.

## Portability

The systemd unit hardcodes `/usr/sbin/nft`, valid on usrmerged distros
(Debian/Ubuntu/Pop/Arch). Adjust if a future target differs.
