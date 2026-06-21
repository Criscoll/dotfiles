#!/usr/bin/env bash
# PreToolUse hook — deny-by-default guard for gws-cli invocations.
# ALL direct gws-cli calls are blocked. Use wrapper scripts in ~/bin/agent_scripts/ instead.
# Non-gws commands pass through (exit 0) without inspection.

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

hook_log_start "gws-guard" "PreToolUse"

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$command" ] && exit 0

deny() {
    hook_log_end "denied" "$1" 0
    jq -n --arg reason "$1" \
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
    exit 0
}

# Credential-file deny rule (req 7): deny any access to .enc token files.
if printf '%s' "$command" | grep -qE 'gws-cli/[^ ]*\.enc'; then
    deny "Credential access blocked: gws-cli token/secret files may not be read, copied, or referenced."
fi

# Returns 0 if the token looks like a gws-family invocation token.
# Matches: gws, gws-cli, gws-cli@<ver>, gws_cli; also "python -m gws" / "python3 -m gws"
# (the "-m gws" case: token passed in is "gws" itself, preceded by "-m" — handled via
# the full segment parse below; here we just test the token word itself.)
is_gws_token() {
    case "$1" in
        gws|gws-cli|gws_cli) return 0 ;;
        gws-cli@*) return 0 ;;
    esac
    return 1
}

# Parse one shell segment and either return (allowed) or call deny().
# A segment is already stripped of leading shell operators.
check_segment() {
    local seg="$1"

    # Tokenise the segment into words (rough split; good enough for the structured
    # commands the agent produces — see Edge Cases in PLAN.md).
    # shellcheck disable=SC2206
    local words=($seg)
    local i=0 n=${#words[@]}
    local gws_pos=-1

    # Find the position of the gws-family token. Skip leading env-var assignments
    # (VAR=val) and known launchers (env, uvx, python, python3, exec).
    while [ $i -lt $n ]; do
        local w="${words[$i]}"
        case "$w" in
            *=*|env|exec) ;;                    # env-var prefix or env/exec
            uvx) ;;                              # uvx launcher
            python|python3)
                # Check for "python -m gws" / "python3 -m gws" pattern
                if [ $((i+1)) -lt $n ] && [ "${words[$((i+1))]}" = "-m" ] && \
                   [ $((i+2)) -lt $n ] && is_gws_token "${words[$((i+2))]}"; then
                    gws_pos=$((i+2))
                    break
                fi
                ;;
            *)
                if is_gws_token "$w"; then
                    gws_pos=$i
                    break
                else
                    # Non-gws, non-prefix first meaningful word — not a gws segment.
                    return
                fi
                ;;
        esac
        i=$((i+1))
    done

    # No gws token found in this segment — not a gws invocation, pass through.
    [ $gws_pos -eq -1 ] && return

    # gws token found. Check for --help exemption only.
    i=$((gws_pos+1))
    while [ $i -lt $n ]; do
        case "${words[$i]}" in
            --help|-h|help) return ;;
        esac
        i=$((i+1))
    done

    deny "Direct gws-cli calls are not allowed. Use the wrapper scripts in ~/bin/agent_scripts/ instead (gmail-list, gmail-search, gmail-read, gmail-labels, gmail-get-metadata, etc.). If no wrapper covers your need: state what you need, confirm no existing wrapper covers it, then ask the user to add a new wrapper script — do not call gws-cli directly."
}

# Split the command into segments on &&, ||, ;, and |.
# We use a state-machine approach: extract text between operators.
# Note: this is a heuristic split — it does not parse quoted strings perfectly,
# but it is sufficient for the structured commands the agent produces.
split_and_check() {
    local cmd="$1"
    # Replace shell operators with a NUL delimiter, then iterate.
    # Use printf + sed to split on &&, ||, ;, |
    local seg
    while IFS= read -r seg; do
        seg="${seg#"${seg%%[! ]*}"}"   # ltrim
        seg="${seg%"${seg##*[! ]}"}"   # rtrim
        [ -z "$seg" ] && continue
        check_segment "$seg"
    done < <(printf '%s\n' "$cmd" | sed 's/&&/\n/g; s/||/\n/g; s/;/\n/g; s/|/\n/g')
}

split_and_check "$command"

hook_log_end "passed" "" 0
exit 0
