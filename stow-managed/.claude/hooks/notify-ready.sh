#!/bin/sh

HOOK_LOGGER="$HOME/.claude/hooks/hook-logger.sh"
if [ -r "$HOOK_LOGGER" ]; then
    . "$HOOK_LOGGER" 2>/dev/null || true
fi
if ! command -v hook_log_start >/dev/null 2>&1; then
    hook_log_start() { :; }
    hook_log_end()   { :; }
fi

hook_log_start "notify-ready" "Notification"

notify_core="$HOME/.claude/hooks/notify-core.sh"
if [ -r "$notify_core" ]; then
    sh "$notify_core" "Claude Code"
fi

hook_log_end "notified" "" 0
