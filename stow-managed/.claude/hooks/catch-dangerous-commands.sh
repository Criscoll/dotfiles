#!/usr/bin/env bash
# PreToolUse hook — intercepts dangerous Bash commands and forces user confirmation.
# Invoked by Claude Code before every Bash tool call.
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

hook_log_start "catch-dangerous-commands" "PreToolUse"

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

# If command is empty (or jq unavailable), allow through
[ -z "$command" ] && exit 0

# Patterns that require explicit user confirmation before running.
# Matched as extended regex against the full command string.
dangerous_patterns=(
    # File deletion — rm as a command (standalone or after batch operators)
    '(^|&&|\|\||;|\|)[[:space:]]*(sudo[[:space:]]+)?rm[[:space:]]'
    # Git file removal
    '(^|&&|\|\||;|\|)[[:space:]]*git[[:space:]]+rm[[:space:]]'
    # Hard reset — discards all uncommitted changes
    'git[[:space:]]+reset[[:space:]]+--hard'
    # Force push — can overwrite remote history
    'git[[:space:]]+push[[:space:]].*(--force|-f)([[:space:]]|$)'
    # Git clean — permanently removes untracked files
    'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'
    # Discard working tree changes
    'git[[:space:]]+(checkout|restore)[[:space:]]+--[[:space:]]'
    # find -delete / find -exec rm — mass file deletion that bypasses the rm pattern
    'find[[:space:]].*-delete'
    'find[[:space:]].*-exec[[:space:]]+(sudo[[:space:]]+)?rm'
    # Pipe to shell — executes arbitrary remote code
    '(curl|wget)[[:space:]].*\|[[:space:]]*(sudo[[:space:]]+)?(bash|sh|zsh)([[:space:]]|$)'
    # Downloading a binary/archive — fetching an installer or release archive
    '(curl|wget)[[:space:]].*\.(tar\.gz|tgz|tar\.xz|tar\.bz2|tar\.zst|zip|[Aa]pp[Ii]mage|deb|rpm)([[:space:]"?/]|$)'
    # Pipe a download straight into tar — extract-on-fetch binary install
    '(curl|wget)[[:space:]].*\|[[:space:]]*(sudo[[:space:]]+)?tar[[:space:]]'
    # Force-delete git branch — no recovery without reflog
    'git[[:space:]]+branch[[:space:]]+-D'
    # Git stash destruction — permanently loses stashed work
    'git[[:space:]]+stash[[:space:]]+(drop|clear)'
    # History rewriting — destructive, often irreversible on remotes
    'git[[:space:]]+(filter-branch|filter-repo)([[:space:]]|$)'
    # Truncate — zeros out file contents without removing the file
    '(^|&&|\|\||;|\|)[[:space:]]*(sudo[[:space:]]+)?truncate[[:space:]]'
    # Shred — secure overwrite/delete, harder to recover than rm
    '(^|&&|\|\||;|\|)[[:space:]]*(sudo[[:space:]]+)?shred[[:space:]]'
    # Sudo — any privileged command execution
    '(^|&&|\|\||;|\|)[[:space:]]*sudo[[:space:]]'
    # Kill — terminate processes
    '(^|&&|\|\||;|\|)[[:space:]]*(sudo[[:space:]]+)?kill(all)?[[:space:]]'
)

ask() {
    hook_log_end "asked" "$1" 0
    jq -n --arg reason "$1" \
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":$reason}}'
    exit 0
}

for pattern in "${dangerous_patterns[@]}"; do
    if printf '%s' "$command" | command grep -qE "$pattern"; then
        ask "Dangerous command detected — explicit user approval required before running: $command"
    fi
done

hook_log_end "passed" "" 0
exit 0
