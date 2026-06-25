#!/usr/bin/env bash
# Read-only triage for the Tailscale+Mullvad CGNAT bypass.
#
# Encodes this session's entire diagnostic tree so future breakage is a one-command
# check. Each step explains WHAT it proves and WHY it matters, tied to the two-mark
# model (ct mark 0x00000f41 passes Mullvad's firewall; meta mark 0x6d6f6c65 makes
# Mullvad's policy routing skip the packet so it routes via tailscale0).
#
# Re-execs itself via sudo if not root (listing nft tables needs root). Logs every
# line to stdout AND a timestamped logfile. Prints a PASS/FAIL summary mapping each
# failure to its likely cause.
#
# Purely diagnostic — changes nothing. To (re)apply the fix:
#   sudo systemctl restart tailscale-mullvad-bypass.service
set -uo pipefail

# Re-exec under sudo so `nft list` works.
if [[ "$(id -u)" -ne 0 ]]; then
    exec sudo --preserve-env=PATH bash "$0" "$@"
fi

TS="$(date +%Y%m%d-%H%M%S)"
LOG="/tmp/tailscale-mullvad-diag-$TS.log"

# log: echo to stdout and append to the logfile.
log() { printf '%s\n' "$*" | tee -a "$LOG" >/dev/null; printf '%s\n' "$*"; }

PASS=0
FAIL=0
declare -a HINTS=()
pass() { log "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { log "  [FAIL] $1"; FAIL=$((FAIL + 1)); [[ $# -ge 2 ]] && HINTS+=("$2"); }
warn() { log "  [WARN] $1"; }

log "=== Tailscale+Mullvad bypass diagnostics — $TS ==="
log "Logfile: $LOG"
log ""

# 1. Interfaces -------------------------------------------------------------------
# Both tunnels must exist; without them nothing downstream is meaningful.
log "[1] Interfaces (tailscale0 + wg0-mullvad)"
IFACES="$(ip -br addr 2>/dev/null)"
log "$IFACES"
if grep -q '^tailscale0' <<<"$IFACES"; then pass "tailscale0 present"; else fail "tailscale0 missing" "Tailscale is down — 'sudo tailscale up'"; fi
if grep -q 'wg0-mullvad' <<<"$IFACES"; then pass "wg0-mullvad present"; else warn "wg0-mullvad missing (Mullvad disconnected — bypass is moot but harmless)"; fi
log ""

# 2. Mullvad state ----------------------------------------------------------------
# Establishes whether the kill-switch is even active right now.
log "[2] Mullvad connection state"
if command -v mullvad >/dev/null 2>&1; then
    MULL="$(mullvad status 2>/dev/null || echo 'mullvad status failed')"
    log "  $MULL"
else
    warn "mullvad CLI not found — skipping"
fi
log ""

# 3. Pick a tailnet peer ----------------------------------------------------------
# Auto-resolve a 100.x peer so the routing/ping checks have a real target.
log "[3] Auto-pick a tailnet peer IP"
PEER=""
if command -v tailscale >/dev/null 2>&1; then
    SELF_IP="$(tailscale ip -4 2>/dev/null || true)"
    PEER="$(tailscale status 2>/dev/null | awk '{print $1}' | grep -E '^100\.' | grep -vF "${SELF_IP:-__none__}" | head -1)"
fi
if [[ -n "$PEER" ]]; then pass "peer = $PEER"; else fail "no tailnet peer found" "No peers in 'tailscale status' — connect another device"; fi
log ""

# 4. Our table loaded & correct ---------------------------------------------------
# The whole fix lives here: a type-route output chain setting BOTH marks.
log "[4] Our nft table (tailscale-mullvad-bypass)"
OURS="$(nft list table inet tailscale-mullvad-bypass 2>/dev/null || echo '')"
if [[ -z "$OURS" ]]; then
    fail "table not loaded" "Run: sudo systemctl restart tailscale-mullvad-bypass.service"
else
    log "$OURS"
    grep -q 'type route hook output' <<<"$OURS" && pass "type route hook output present" || fail "no route hook" "Chain must be 'type route' to affect routing — re-copy the .nft"
    grep -q 'ct mark set 0x00000f41' <<<"$OURS" && pass "ct mark 0x00000f41 set" || fail "ct mark missing" "Without ct mark Mullvad's kill-switch rejects the packet"
    grep -q 'meta mark set 0x6d6f6c65' <<<"$OURS" && pass "meta mark 0x6d6f6c65 set" || fail "meta mark missing" "Without meta mark Mullvad reroutes the packet down wg0-mullvad"
fi
log ""

# 5. Mullvad's accept rule --------------------------------------------------------
# Our ct mark only helps if Mullvad still has its matching accept rule.
log "[5] Mullvad's 'ct mark 0x00000f41 accept' rule"
MULLNFT="$(nft list table inet mullvad 2>/dev/null || echo '')"
if grep -q 'ct mark 0x00000f41 accept' <<<"$MULLNFT"; then
    pass "Mullvad accept rule present"
else
    fail "Mullvad accept rule absent" "Mullvad changed its firewall — our ct mark no longer passes; recheck Mullvad docs"
fi
log ""

# 6. Routing decision -------------------------------------------------------------
# Subtlety: `ip route get` does NOT run the nftables route-hook chain, so a plain
# query sees an UNMARKED packet — Mullvad's rule 5204 matches and it shows wg0-mullvad.
# That is expected and NOT a failure. To simulate the real (post-mark) decision we
# pass the meta mark: with fwmark 0x6d6f6c65, rule 5204 declines and the lookup falls
# through to Tailscale's table 52 (dev tailscale0). The real packet gets this mark set
# by our output chain at send time, which is why check 9's ping actually succeeds.
log "[6] Route to peer ($PEER)"
if [[ -n "$PEER" ]]; then
    UNMARKED="$(ip route get "$PEER" 2>/dev/null || echo '')"
    MARKED="$(ip route get "$PEER" mark 0x6d6f6c65 2>/dev/null || echo '')"
    log "  unmarked:        $UNMARKED"
    log "  marked(0x6d6f6c65): $MARKED"
    if grep -q 'dev tailscale0' <<<"$MARKED"; then
        pass "marked traffic routes via tailscale0"
    elif grep -q 'wg0-mullvad' <<<"$MARKED"; then
        fail "marked traffic routes via wg0-mullvad" "meta mark / route hook not applied — Mullvad's rule 5204 is still catching the packet"
    else
        warn "unexpected marked route: $MARKED"
    fi
fi
log ""

# 7. ip rules ---------------------------------------------------------------------
# Surface Mullvad's 520x and Tailscale's 527x; flag a stale 5200 from the old fix.
log "[7] Policy routing rules (520x / 527x)"
RULES="$(ip rule list | grep -E '52[0-9][0-9]' || true)"
log "$RULES"
if grep -qE '^5200:' <<<"$RULES"; then
    warn "stale 'ip rule 5200' present — leftover from the retired approach; remove with: sudo ip rule del prio 5200"
else
    pass "no stale 5200 rule"
fi
log ""

# 8. Service state ----------------------------------------------------------------
log "[8] systemd unit (tailscale-mullvad-bypass.service)"
ACT="$(systemctl is-active tailscale-mullvad-bypass.service 2>/dev/null || true)"
ENA="$(systemctl is-enabled tailscale-mullvad-bypass.service 2>/dev/null || true)"
log "  is-active=$ACT  is-enabled=$ENA"
[[ "$ACT" == "active" ]] && pass "service active" || fail "service not active ($ACT)" "Run: sudo systemctl restart tailscale-mullvad-bypass.service"
[[ "$ENA" == "enabled" ]] && pass "service enabled" || warn "service not enabled — won't survive reboot"
log ""

# 9. Connectivity -----------------------------------------------------------------
# The original smoking gun: 'tailscale ping' (public relay path) works even when
# the kernel path is blocked, so a relay-OK / kernel-FAIL contrast => marks broken.
log "[9] Connectivity (kernel path vs relay path)"
if [[ -n "$PEER" ]]; then
    if ping -c3 -W2 "$PEER" >/dev/null 2>&1; then
        pass "ping $PEER (kernel path) succeeds"
    else
        fail "ping $PEER (kernel path) fails" "Kernel path blocked — see route/mark hints above"
    fi
    if command -v tailscale >/dev/null 2>&1; then
        if tailscale ping "$PEER" >/dev/null 2>&1; then
            log "  tailscale ping (relay path) succeeds"
        else
            warn "tailscale ping (relay path) also fails — peer may be offline, not a routing issue"
        fi
    fi
fi
log ""

# 10. Summary ---------------------------------------------------------------------
log "=== Summary: $PASS passed, $FAIL failed ==="
if [[ $FAIL -eq 0 ]]; then
    log "All checks passed — bypass is healthy."
else
    log "Likely causes:"
    for h in "${HINTS[@]}"; do log "  - $h"; done
fi
log ""
log "Full log saved to: $LOG"
exit $((FAIL > 0 ? 1 : 0))
