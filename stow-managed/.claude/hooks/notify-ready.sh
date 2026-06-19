#!/bin/sh

# Best-effort hook logging. Logger absence must never break the hook.
HOOK_LOGGER="$HOME/.claude/hooks/hook-logger.sh"
if [ -r "$HOOK_LOGGER" ]; then
    # shellcheck source=/dev/null
    . "$HOOK_LOGGER" 2>/dev/null || true
fi
# Fallback no-ops if source failed or logger was absent
if ! command -v hook_log_start >/dev/null 2>&1; then
    hook_log_start() { :; }
    hook_log_end()   { :; }
fi

hook_log_start "notify-ready" "Notification"

if command -v notify-send > /dev/null 2>&1; then
    notify-send 'Claude Code' 'Ready for input'
elif command -v osascript > /dev/null 2>&1; then
    osascript -e 'display notification "Ready for input" with title "Claude Code"'
fi

hook_log_end "notified" "" 0
