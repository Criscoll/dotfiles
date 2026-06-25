#!/bin/sh
# notify-core.sh <title-prefix>
# Sends pane-aware tmux + desktop notifications.
# Exits 0 if desktop notification sent; exits 1 if tmux-only (caller may fallback).

title_prefix="${1:-Notification}"

pane_label=""
if [ -n "$TMUX_PANE" ] && command -v tmux >/dev/null 2>&1; then
    pane_label=$(tmux display-message -p -t "$TMUX_PANE" '#S:#W' 2>/dev/null)
    printf '\a'
    msg="${title_prefix} ready${pane_label:+: $pane_label}"
    tmux list-clients -F '#{client_name}' 2>/dev/null | while IFS= read -r client; do
        tmux display-message -c "$client" -d 5000 "$msg" 2>/dev/null
    done
fi

title="${title_prefix}${pane_label:+ — $pane_label}"
body="Ready for input"

if command -v notify-send >/dev/null 2>&1; then
    notify-send "$title" "$body"
    exit 0
elif command -v osascript >/dev/null 2>&1; then
    osascript -e "display notification \"$body\" with title \"$title\""
    exit 0
fi

exit 1
