#!/usr/bin/env bash
# PreToolUse hook — intercepts dangerous Bash commands and forces user confirmation.
# Invoked by Claude Code before every Bash tool call.
# Input: JSON on stdin with structure { "tool_input": { "command": "..." } }
#
# Fails open: if the command cannot be parsed, the hook exits 0 (allow through).

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
)

for pattern in "${dangerous_patterns[@]}"; do
    if echo "$command" | grep -qE "$pattern"; then
        printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Dangerous command detected — explicit user approval required before running."}}'
        exit 0
    fi
done

exit 0
