# Network Diagnostics Reference

Layered bottom-up methodology. Each layer proves something specific; work top-to-bottom to localize the break,
then dive into the layer that explains the failure.

---

## Layer 0 — Localize the break

Answer these in order; stop at the first failure:

```bash
ping -c1 127.0.0.1        # localhost reachable?
ping -c1 192.168.x.1      # default gateway reachable? (get IP from `ip route`)
ping -c1 8.8.8.8           # public IP reachable?
ping -c1 google.com        # public name resolves?
```

| First failure | Implication |
|---|---|
| localhost | Interface/kernel issue (rare) |
| gateway | Link-layer or local routing problem |
| public IP | Routing or firewall problem |
| public name | DNS problem (routing is fine) |

---

## Layer 1 — Interface / link

```bash
ip -br addr     # interface addresses, state (UP/DOWN/UNKNOWN)
ip -br link     # carrier state, MAC, link flags
nmcli device    # NetworkManager connection state
iw dev          # wifi: interface, type, channel
```

Look for: interface DOWN, no IP assigned, wifi not associated.

For wifi association:
```bash
iw dev <iface> link    # shows BSSID and signal if associated
nmcli -f NAME,DEVICE,STATE con show --active
```

---

## Layer 2 — IP / routing

```bash
ip route                       # routing table; look for default route
ip route get 8.8.8.8           # which interface/gateway a real packet takes
ip rule                        # policy routing rules (priority order)
ip route show table all        # all tables (main + extras)
```

**The mark trick** — simulating policy routing without running packets through nftables:

```bash
ip route get 8.8.8.8 mark 0x<fwmark>
```

`ip route get` evaluates policy routing rules (ip rule) using the supplied mark, without running the packet
through any nftables chains. This is how you verify that fwmark-based routing tables work even before
nftables is writing the marks. False negative trap from the Tailscale+Mullvad session: `ip route get 8.8.8.8`
showed the Mullvad table correctly, but the *kernel path* still failed because nftables was dropping packets
before the mark was applied. Never assume routing is fine just because `ip route get` shows the right table.

For multiple routing tables:
```bash
ip route show table <N>        # inspect a specific table by number
cat /etc/iproute2/rt_tables    # table number ↔ name mapping
```

---

## Layer 3 — DNS

Symptom: `ping 8.8.8.8` works but `ping google.com` fails — DNS only.

```bash
resolvectl status              # per-interface DNS config and search domains
resolvectl query google.com    # ask systemd-resolved directly
getent hosts google.com        # what the libc resolver returns (uses /etc/nsswitch.conf)
dig @8.8.8.8 google.com        # query a specific server directly (bypasses systemd-resolved)
cat /etc/resolv.conf           # what the system resolver is configured to use
```

Common causes:
- Wrong DNS server per interface (VPN hijacking DNS for the wrong interface)
- systemd-resolved routing queries to a VPN tunnel that has no internet
- `/etc/resolv.conf` pointing at `127.0.0.53` when systemd-resolved is broken

---

## Layer 4 — Firewall / policy / VPN kill-switch

```bash
nft list ruleset               # full nftables ruleset
nft list ruleset | grep -i 'drop\|reject\|accept'   # quick scan for policy
iptables -L -n -v              # if iptables (not nftables) is in use
conntrack -L | head -20        # connection tracking state (if conntrack installed)
```

Look for: `reject`/`drop` rules, kill-switch chains, fwmark-based routing that drops non-VPN traffic.

**Heuristic from the Tailscale+Mullvad session:**

> If `tailscale ping <peer>` (relay path) succeeds but `ping <peer-IP>` (kernel path) fails, the problem is
> routing or firewall — not the peer, not Tailscale's control plane, not DNS.
>
> Relay traffic bypasses the kernel routing + nftables stack. Kernel-path traffic doesn't. So this divergence
> isolates the failure to the local kernel path.

**Tailscale + Mullvad worked example:**

See `docs/tailscale-mullvad-routing-2026-06-25.md` for the full writeup (two-mark mechanism, nft marks,
CGNAT bypass). The automated diagnostic is at `system/diagnose-tailscale-mullvad.sh`.

---

## Layer 5 — Reachability / ports

```bash
ping -c3 <host>                        # basic ICMP reachability
mtr --report <host>                    # traceroute with loss/latency per hop
traceroute <host>                      # or tracepath <host>
ss -tlnp                               # what's listening on TCP (local services)
curl -v http://<host>:<port>/          # full HTTP with headers + TLS negotiation
nc -vz <host> <port>                   # raw TCP connection test (no HTTP)
```

**Decoding connection errors:**

| Error | Meaning |
|---|---|
| Connection refused | Host reached, nothing listening on that port |
| No route to host / Network unreachable | Routing or firewall (packet never arrives) |
| Connection timed out | Packet arrives but is silently dropped (filtered) |
| Name or service not known | DNS failure (see Layer 3) |

---

## Symptom → likely layer

| Symptom | Start at |
|---|---|
| No internet at all, gateway unreachable | L1 (interface) |
| Gateway reachable, public IPs not | L2 (routing) or L4 (firewall) |
| IPs work, names don't | L3 (DNS) |
| Works without VPN, fails with VPN | L4 (VPN kill-switch / routing policy) |
| `tailscale ping` works, `ping` doesn't | L4 (local nftables/routing) |
| Works for some hosts, not others | L2 (routing table) or L4 (ACLs) |
| Connection refused | L5 — service not running / wrong port |
| Timeout to specific port | L4 (firewall dropping that port) |

---

## macOS equivalents

| Linux command | macOS equivalent |
|---|---|
| `ip -br addr` | `ifconfig` |
| `ip route` | `netstat -rn` |
| `ip route get <dest>` | `route -n get <dest>` |
| `ip rule` | `netstat -rn` (no direct equivalent for policy routing) |
| `nft list ruleset` | `pfctl -s rules` |
| `resolvectl status` | `scutil --dns` |
| `ss -tlnp` | `lsof -i -P -n \| grep LISTEN` or `netstat -an \| grep LISTEN` |
| `ping` / `mtr` | same (mtr may need brew install) |
| `nc -vz` | same |
