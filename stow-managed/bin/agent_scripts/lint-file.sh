#!/usr/bin/env bash
# lint-file.sh — Dispatch script for agent harness lint-on-edit.
#
# Maps file extensions to lint commands. Both the Claude Code PostToolUse hook
# and the pi lint-on-edit extension delegate to this single script.
#
# Usage: lint-file.sh <file-path>
#
# Adding a new language: add one case arm below with a `command -v` guard.
# No changes needed to the hook config or pi extension.

set -euo pipefail

file="$1"
if [[ -z "$file" || ! -f "$file" ]]; then
  exit 0
fi

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.svelte)
    if command -v npx >/dev/null 2>&1; then
      npx eslint --fix "$file" 2>&1 || true
    fi
    ;;
  *.py)
    if command -v uvx >/dev/null 2>&1; then
      uvx ruff check --fix "$file" 2>&1 || true
    fi
    ;;
esac