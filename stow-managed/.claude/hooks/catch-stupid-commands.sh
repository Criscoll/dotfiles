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

# Flat array: 4 elements per rule — (pattern, suggestion, exception, required_tool).
# Keeping fields adjacent prevents silent out-of-sync bugs from parallel arrays.
# Set exception to '' when no exception is needed.
# Set required_tool to the binary the suggestion depends on (e.g. 'rg', 'fd').
# Set required_tool to '' when the alternative needs no new tool.
# Rules are skipped (command allowed through) when required_tool is absent on $PATH.
rules=(
    # rg -r used as recursive flag — actually means --replace; rg recurses by default
    'rg[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*([[:space:]]|$)'
    "rg -r means --replace, not recursive. rg recurses directories by default — no flag needed. Use: rg <pattern> [path]"
    ''
    ''

    # rg with \| alternation (grep BRE syntax) — rg uses | for alternation, not \|
    'rg[[:space:]]+.*\\\|'
    "rg uses | for alternation (not \\|). Use: rg 'pat1|pat2' [path]  or  rg -e 'pat1' -e 'pat2' [path]"
    ''
    ''

    # grep -r / -R / combined flags (e.g. -rn, -rl, -ri): ripgrep is faster and respects .gitignore
    'grep[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*([[:space:]]|$)'
    "grep -r is slow and does not respect .gitignore. Use rg instead: rg <pattern> [path]"
    ''
    'rg'

    # grep --recursive (long form)
    'grep[[:space:]]+--recursive([[:space:]]|$)'
    "grep --recursive is slow and does not respect .gitignore. Use rg instead: rg <pattern> [path]"
    ''
    'rg'

    # useless use of cat piped to grep
    'cat[[:space:]]+[^|]+\|[[:space:]]*grep[[:space:]]'
    "Useless use of cat. Pass the file directly to grep: grep <pattern> <file>"
    ''
    ''

    # useless use of cat piped to wc -l
    'cat[[:space:]]+[^|]+\|[[:space:]]*wc[[:space:]]+-l'
    "Useless use of cat. Pass the file directly to wc: wc -l <file>"
    ''
    ''

    # find piped to xargs: fd --exec/-x is safer (handles spaces) and more direct
    'find[[:space:]]+[^|]*\|[[:space:]]*xargs([[:space:]]|$)'
    "find | xargs is inefficient. Use fd with --exec (-x): fd [pattern] [path] -t f -x <cmd> {}. The -x flag handles spaces in filenames and is safer than xargs."
    ''
    'fd'

    # find -name / -iname for file searching: fd is faster and has simpler syntax
    'find[[:space:]]+.*-i?name[[:space:]]'
    "find -name is verbose for file searches. Use fd instead: fd <pattern> [path]"
    ''
    'fd'

    # find -type f/d: fd -t f/d is faster and simpler
    # Exception: allow when using predicates fd cannot replicate (-perm, -user, -group)
    'find[[:space:]]+.*[[:space:]]-type[[:space:]]+[fd]([[:space:]]|$)'
    "Use fd for type-based searches: fd -t f [path] or fd -t d [path]. fd also supports: --changed-after <file> (replaces -newer), --changed-within <duration> (replaces -mtime), --size <spec> (replaces -size). Only use find when filtering by -perm, -user, or -group."
    'find[[:space:]]+.*(-(perm|user|group)[[:space:]])'
    'fd'
)

deny() {
    hook_log_end "denied" "$1" 0
    jq -n --arg reason "$1" \
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
    exit 0
}

for ((i=0; i<${#rules[@]}; i+=4)); do
    pattern="${rules[i]}"
    suggestion="${rules[i+1]}"
    exception="${rules[i+2]}"
    required_tool="${rules[i+3]}"

    if [ -n "$required_tool" ] && ! command -v "$required_tool" &>/dev/null; then
        continue
    fi

    if printf '%s' "$command" | command grep -qE "$pattern"; then
        if [ -n "$exception" ] && printf '%s' "$command" | command grep -qE "$exception"; then
            continue
        fi
        deny "$suggestion"
    fi
done

hook_log_end "passed" "" 0
exit 0
