#!/usr/bin/env bash
# PreToolUse hook — blocks inefficient commands and feeds a specific alternative back to Claude.
# Uses permissionDecision:deny so Claude self-corrects without prompting the user.
# Input: JSON on stdin with structure { "tool_input": { "command": "..." } }
#
# Fails open: if the command cannot be parsed, the hook exits 0 (allow through).

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

hook_log_start "catch-stupid-commands" "PreToolUse"

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$command" ] && exit 0

deny() {
    hook_log_end "denied" "$1" 0
    jq -n --arg reason "$1" \
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
    exit 0
}

suggestion=$(~/bin/agent_scripts/check-inefficient-command.sh "$command")
[ -z "$suggestion" ] && { hook_log_end "passed" "" 0; exit 0; }
deny "$suggestion"
