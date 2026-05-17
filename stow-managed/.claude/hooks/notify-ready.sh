#!/bin/sh
if command -v notify-send > /dev/null 2>&1; then
    notify-send 'Claude Code' 'Ready for input'
elif command -v osascript > /dev/null 2>&1; then
    osascript -e 'display notification "Ready for input" with title "Claude Code"'
fi
