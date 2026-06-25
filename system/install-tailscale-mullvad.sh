#!/usr/bin/env bash
# Lets a machine running Tailscale and Mullvad VPN at once reach Tailscale CGNAT
# peers (100.64.0.0/10) without Mullvad's kill-switch rejecting the traffic.
#
# Mullvad's official method (split-tunneling-with-linux-advanced): set TWO marks on
# the traffic to exclude, in a `type route hook output` nftables chain:
#   ct mark 0x00000f41   -> passes Mullvad's firewall kill-switch.
#   meta mark 0x6d6f6c65 -> makes Mullvad's policy routing skip the packet, so it
#                           routes via tailscale0 instead of wg0-mullvad.
# Both marks in one route-hook chain => no custom ip rule or routing service needed.
#
# Safe to re-run — idempotent.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SRC="$SCRIPT_DIR/systemd/tailscale-mullvad-bypass.service"
SERVICE_DEST="/etc/systemd/system/tailscale-mullvad-bypass.service"
NFT_SRC="$SCRIPT_DIR/nftables/tailscale-mullvad-bypass.nft"
NFT_DEST="/etc/nftables.d/tailscale-mullvad-bypass.nft"

echo "=== Installing Tailscale+Mullvad bypass ==="

# --- Migration: tear down the old over-engineered two-part fix (ip rule + routing
# service). Harmless on a fresh machine where none of it exists. ---
echo "--- Migrating away from old routing service / ip rule (if present) ---"
sudo systemctl disable --now tailscale-mullvad-routing.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/tailscale-mullvad-routing.service
sudo ip rule del prio 5200 2>/dev/null || true
sudo nft delete table inet tailscale-mullvad-bypass 2>/dev/null || true

# --- Install the new artifacts ---
sudo mkdir -p /etc/nftables.d
sudo cp "$NFT_SRC" "$NFT_DEST"
echo "Copied: $NFT_DEST"

sudo cp "$SERVICE_SRC" "$SERVICE_DEST"
echo "Copied: $SERVICE_DEST"

sudo systemctl daemon-reload
# restart (not enable --now) so a re-run reloads the table even if already active.
sudo systemctl restart tailscale-mullvad-bypass.service
sudo systemctl enable tailscale-mullvad-bypass.service
echo "Service enabled and started"

echo "=== Done. Verify with: sudo bash $SCRIPT_DIR/diagnose-tailscale-mullvad.sh ==="
