#!/usr/bin/env bash
# PreToolUse hook — deny-by-default allow-list for gws-cli invocations.
# Permits only explicit read+move (Gmail) and read+create+update (Calendar) subcommands.
# Fails closed: if a segment mentions a gws token but the (service, subcommand) pair
# cannot be confidently extracted, the command is denied.
# Non-gws commands pass through (exit 0) without inspection.

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

[ -z "$command" ] && exit 0

deny() {
    jq -n --arg reason "$1" \
        '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
    exit 0
}

# Credential-file deny rule (req 7): deny any access to .enc token files.
if printf '%s' "$command" | grep -qE 'gws-cli/[^ ]*\.enc'; then
    deny "Credential access blocked: gws-cli token/secret files may not be read, copied, or referenced."
fi

# --- Allow-lists (single source of truth, parallel to gws-guard.ts) ---

GMAIL_ALLOW="list read search labels get-label drafts get-draft threads get-thread \
list-attachments download-attachment get-vacation get-signature filters \
get-filter history add-labels remove-labels modify-thread-labels batch-modify \
mark-read mark-unread create-label"

CALENDAR_ALLOW="calendars list get instances attendees freebusy colors list-acl \
get-reminders get-default-reminders create update create-recurring quick-add \
add-attendees remove-attendees rsvp set-reminders set-default-reminders move-event"

# Returns 0 if the word is in the allow-list string, 1 otherwise.
in_list() {
    local word="$1" list="$2" w
    for w in $list; do
        [ "$w" = "$word" ] && return 0
    done
    return 1
}

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

    # gws token found. Now extract (service, subcommand).
    # Tokens after gws_pos: skip --flag/-f options and their values.
    local service="" subcmd=""
    i=$((gws_pos+1))
    while [ $i -lt $n ]; do
        local w="${words[$i]}"
        case "$w" in
            --help|-h|help)
                # Help flag / no subcommand — always allowed (read-only meta).
                return
                ;;
            --*=*)
                # --key=val style flag — skip (no extra word consumed).
                ;;
            --*)
                # --flag that consumes the next word as its value — skip both.
                i=$((i+1))
                ;;
            -*)
                # Short flag — skip (single char flags don't consume next word here).
                ;;
            gmail|calendar)
                service="$w"
                break
                ;;
            *)
                # Unexpected word before service token — fail closed.
                deny "gws command blocked: could not locate a known service (gmail/calendar) in: ${seg}"
                ;;
        esac
        i=$((i+1))
    done

    # No service token found at all.
    if [ -z "$service" ]; then
        # Bare `gws` / `gws-cli` with no service — help or bare invocation, allow.
        return
    fi

    # Now find the subcommand: first bare word after the service, skipping flags.
    i=$((i+1))
    while [ $i -lt $n ]; do
        local w="${words[$i]}"
        case "$w" in
            --*=*) ;;
            --*) i=$((i+1)) ;;      # value-consuming long flag
            -*) ;;                   # short flag
            help|--help|-h)
                return ;;            # help after service — allowed
            *)
                subcmd="$w"
                break
                ;;
        esac
        i=$((i+1))
    done

    # No subcommand — bare `gws gmail` / `gws calendar` (lists subcommands) — allow.
    [ -z "$subcmd" ] && return

    # Check (service, subcommand) against allow-list.
    case "$service" in
        gmail)
            if ! in_list "$subcmd" "$GMAIL_ALLOW"; then
                deny "gws gmail '$subcmd' is not on the allow-list. Only read+move Gmail commands are permitted. Denied subcommand: $subcmd"
            fi
            ;;
        calendar)
            if ! in_list "$subcmd" "$CALENDAR_ALLOW"; then
                deny "gws calendar '$subcmd' is not on the allow-list. Only read+create+update Calendar commands are permitted. Denied subcommand: $subcmd"
            fi
            ;;
    esac
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

exit 0
