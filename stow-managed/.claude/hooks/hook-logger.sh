#!/usr/bin/env bash
# hook-logger.sh — shared logging helpers for Claude Code hooks.
# Source this in every hook script, then call hook_log_start / hook_log_end.
#
# DESIGNED TO FAIL SILENTLY: if the log directory can't be created or jq is
# unavailable, records are silently dropped. The hook's safety function is
# never affected.
#
# Schema (JSONL, one object per line):
#   ts          — ISO 8601 UTC timestamp
#   harness     — "claude-code"
#   hook        — hook name, e.g. "catch-dangerous-commands"
#   event       — Claude Code hook event type, e.g. "PreToolUse", "Notification"
#   outcome     — "passed" | "asked" | "denied" | "notified" | "error"
#   reason      — human-readable reason/decision string
#   duration_ms — elapsed wall-clock ms
#   exit_code   — numeric exit code (0 on success)

HOOK_LOG_FILE="$HOME/.local/share/hook-analytics/hooks.jsonl"

hook_log_start() {
    HOOK_NAME="$1"
    HOOK_EVENT="$2"
    HOOK_START_MS=$(date +%s%3N 2>/dev/null || echo 0)
}

hook_log_end() {
    local outcome="$1"
    local reason="$2"
    local exit_code="${3:-0}"
    local now_ms
    now_ms=$(date +%s%3N 2>/dev/null || echo 0)
    local duration_ms=$(( now_ms - HOOK_START_MS ))
    local ts
    ts=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "1970-01-01T00:00:00Z")

    # Best-effort: if dir creation or jq fails, the hook still runs.
    mkdir -p "$(dirname "$HOOK_LOG_FILE")" 2>/dev/null || true

    jq -nc \
        --arg ts "$ts" \
        --arg harness "claude-code" \
        --arg hook "$HOOK_NAME" \
        --arg event "$HOOK_EVENT" \
        --arg outcome "$outcome" \
        --arg reason "$reason" \
        --argjson duration_ms "$duration_ms" \
        --argjson exit_code "$exit_code" \
        '{
            ts: $ts,
            harness: $harness,
            hook: $hook,
            event: $event,
            outcome: $outcome,
            reason: $reason,
            duration_ms: $duration_ms,
            exit_code: $exit_code
        }' >> "$HOOK_LOG_FILE" 2>/dev/null || true
}