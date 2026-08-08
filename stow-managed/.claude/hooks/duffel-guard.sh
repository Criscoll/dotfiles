#!/usr/bin/env bash
# PreToolUse hook — structural guard for Duffel API usage.
# Legit use goes through the wrapper scripts in ~/bin/agent_scripts/, whose command
# lines never contain the API host, booking endpoints, or the token env var names —
# so a whole-command regex match is enough here (no tokenizing needed).
# Non-Duffel commands pass through (exit 0) without inspection.

# Best-effort hook logging. Logger absence must never break the hook.
HOOK_LOGGER="$HOME/.claude/hooks/hook-logger.sh"
if [ -r "$HOOK_LOGGER" ]; then
    source "$HOOK_LOGGER" 2>/dev/null || true
fi
# Fallback no-ops if source failed or logger was absent
if ! declare -f hook_log_start >/dev/null 2>&1; then
    hook_log_start() { :; }
    hook_log_end()   { :; }
fi

hook_log_start "duffel-guard" "PreToolUse"

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$command" ] && exit 0

deny() {
    hook_log_end "denied" "$1" 0
    jq -n --arg reason "$1" \
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
    exit 0
}

# Booking/charging endpoints — the hardest deny. No wrapper implements these; a
# raw call is the only way an agent could reach them, so block it outright.
if printf '%s' "$command" | grep -qE '/air/(orders|order_cancellations|payments)'; then
    deny "Booking/charging endpoints are blocked: this tooling is search-only."
fi

# Any direct access to the Duffel API host, bypassing the wrappers entirely.
if printf '%s' "$command" | grep -qE 'api\.duffel\.com'; then
    deny "Direct Duffel API calls are not allowed. Use ~/bin/agent_scripts/duffel-flight-search | duffel-offer-get | duffel-check."
fi

# Token exfiltration — the token must never appear on a command line (echo, printf, etc).
if printf '%s' "$command" | grep -qE 'DUFFEL_(TOKEN|LIVE)_READ_WRITE'; then
    deny "Duffel API token env vars may not be referenced on the command line."
fi

hook_log_end "passed" "" 0
exit 0
