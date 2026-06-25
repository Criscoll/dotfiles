# system/

System-level config installed into `/etc` (not stowed into `~`). Like `dockerfiles/`,
this is a top-level non-stow directory; apply per machine with the install script below.

## Tailscale + Mullvad CGNAT bypass

Lets a machine running Tailscale and Mullvad VPN at once reach Tailscale CGNAT peers
(`100.64.0.0/10`) without Mullvad's kill-switch rejecting the traffic. Works by marking
that traffic so Mullvad neither reroutes it (`meta mark 0x6d6f6c65`) nor rejects it
(`ct mark 0x00000f41`) — Mullvad's official method. One `type route` nft chain, no
custom `ip rule`.

Full mechanism: `docs/tailscale-mullvad-routing-2026-06-25.md`.

**Artifacts**
- `nftables/tailscale-mullvad-bypass.nft` → `/etc/nftables.d/`
- `systemd/tailscale-mullvad-bypass.service` → `/etc/systemd/system/`

**Install** (idempotent; migrates away from the old `-routing.service` + `ip rule 5200`):
```bash
sudo bash install-tailscale-mullvad.sh
```

**Verify** (read-only; auto-picks a peer, logs to `/tmp`, prints PASS/FAIL):
```bash
sudo bash diagnose-tailscale-mullvad.sh
```

**Uninstall**:
```bash
sudo systemctl disable --now tailscale-mullvad-bypass.service
sudo nft delete table inet tailscale-mullvad-bypass
```

**Portability:** the unit hardcodes `/usr/sbin/nft` (valid on usrmerged distros —
Debian/Ubuntu/Pop/Arch). Adjust if a future target differs.
