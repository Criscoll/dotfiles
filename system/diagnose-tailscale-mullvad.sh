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

# log: print clean to stdout; append the same line timestamped to the logfile so
# the on-disk record is replayable with per-line timing.
log() { printf '%s\n' "$*"; printf '%s %s\n' "$(date +%H:%M:%S)" "$*" >>"$LOG"; }

PASS=0
FAIL=0
SKIP=0
declare -a HINTS=()
pass() { log "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { log "  [FAIL] $1"; FAIL=$((FAIL + 1)); [[ $# -ge 2 ]] && HINTS+=("$2"); }
warn() { log "  [WARN] $1"; }
# skip: a check that could not run for a benign reason (e.g. no online peer to
# ping). Distinct from FAIL so it never colours the exit code or the summary red.
skip() { log "  [SKIP] $1"; SKIP=$((SKIP + 1)); }

log "=== Tailscale+Mullvad bypass diagnostics — $TS ==="
log "Logfile: $LOG"
log "Host: $(hostname)   Kernel: $(uname -r)"
log "tailscale: $(tailscale version 2>/dev/null | head -1 || echo n/a)   mullvad: $(mullvad version 2>/dev/null | awk -F': *' '/Current version/{print $2; exit}' || echo n/a)"
log ""

# 1. Interfaces -------------------------------------------------------------------
# Both tunnels must exist; without them nothing downstream is meaningful.
log "[1] Interfaces (tailscale0 + Mullvad wg tunnel)"
IFACES="$(ip -br addr 2>/dev/null)"
log "$IFACES"
# Mullvad's tunnel interface has been named both 'wg0-mullvad' (older) and
# 'wg-mullvad' (current) across releases — detect whichever is present rather
# than hard-coding one and falsely reporting Mullvad disconnected.
MULLVAD_IFACE="$(awk '{print $1}' <<<"$IFACES" | grep -E '^wg[0-9]*-mullvad$' | head -1)"
if grep -q '^tailscale0' <<<"$IFACES"; then pass "tailscale0 present"; else fail "tailscale0 missing" "Tailscale is down — 'sudo tailscale up'"; fi
if [[ -n "$MULLVAD_IFACE" ]]; then pass "Mullvad tunnel present ($MULLVAD_IFACE)"; else warn "no Mullvad wg tunnel (Mullvad disconnected — bypass is moot but harmless)"; fi
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
log "[3] Auto-pick an ONLINE tailnet peer IP"
PEER=""
PEERS_TOTAL=0
PEERS_ONLINE=0
if command -v tailscale >/dev/null 2>&1; then
    SELF_IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
    TS_STATUS="$(tailscale status 2>/dev/null || true)"
    log "$TS_STATUS"
    # A peer line starts with a 100.x IP; an offline peer carries the 'offline'
    # token in its status column. Picking only an online peer avoids the old
    # false FAIL — an offline device fails ping regardless of whether the routing
    # marks are correct, which is a property of the peer, not the bypass.
    PEERS_TOTAL="$(awk -v self="${SELF_IP:-__none__}" '$1 ~ /^100\./ && $1 != self {n++} END{print n+0}' <<<"$TS_STATUS")"
    PEERS_ONLINE="$(awk -v self="${SELF_IP:-__none__}" '$1 ~ /^100\./ && $1 != self && $0 !~ /offline/ {n++} END{print n+0}' <<<"$TS_STATUS")"
    PEER="$(awk -v self="${SELF_IP:-__none__}" '$1 ~ /^100\./ && $1 != self && $0 !~ /offline/ {print $1; exit}' <<<"$TS_STATUS")"
fi
log "  peers: $PEERS_TOTAL total, $PEERS_ONLINE online"
if [[ -n "$PEER" ]]; then
    pass "peer = $PEER (online)"
elif [[ "$PEERS_TOTAL" -gt 0 ]]; then
    warn "all $PEERS_TOTAL tailnet peers offline — routing checks still run; the ping check is skipped, not failed"
else
    fail "no tailnet peer found" "No peers in 'tailscale status' — connect another device"
fi
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
    elif grep -qE 'wg[0-9]*-mullvad' <<<"$MARKED"; then
        fail "marked traffic routes via Mullvad tunnel (${MULLVAD_IFACE:-wg-mullvad})" "meta mark / route hook not applied — Mullvad's rule 5204 is still catching the packet"
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
if [[ -z "$PEER" ]]; then
    if [[ "$PEERS_TOTAL" -gt 0 ]]; then
        skip "no online peer to ping — all $PEERS_TOTAL peers offline (cannot exercise the kernel path; not a routing fault)"
    else
        skip "no tailnet peer available to ping"
    fi
else
    PING_OUT="$(ping -c3 -W2 "$PEER" 2>&1)"
    log "$PING_OUT"
    if grep -q ' 0% packet loss' <<<"$PING_OUT"; then
        pass "ping $PEER (kernel path) succeeds"
    else
        fail "ping $PEER (kernel path) fails" "Kernel path blocked — see route/mark hints above"
    fi
    if command -v tailscale >/dev/null 2>&1; then
        if tailscale ping "$PEER" >/dev/null 2>&1; then
            log "  tailscale ping (relay path) succeeds"
        else
            warn "tailscale ping (relay path) also fails — peer may have just dropped, not necessarily a routing issue"
        fi
    fi
fi
log ""

# 10. Summary ---------------------------------------------------------------------
log "=== Summary: $PASS passed, $FAIL failed, $SKIP skipped ==="
if [[ $FAIL -eq 0 ]]; then
    if [[ $SKIP -gt 0 ]]; then
        log "Core checks passed — bypass is healthy ($SKIP check(s) skipped for lack of an online peer)."
    else
        log "All checks passed — bypass is healthy."
    fi
else
    log "Likely causes:"
    for h in "${HINTS[@]}"; do log "  - $h"; done
fi
log ""
log "Full log saved to: $LOG"
exit $((FAIL > 0 ? 1 : 0))
