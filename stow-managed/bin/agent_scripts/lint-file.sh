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
      abs_file="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$file")"
      dir="$(dirname "$abs_file")"
      config_root=""
      while [[ "$dir" != "/" ]]; do
        for cfg in eslint.config.js eslint.config.mjs eslint.config.cjs; do
          if [[ -f "$dir/$cfg" ]]; then
            config_root="$dir"
            break 2
          fi
        done
        dir="$(dirname "$dir")"
      done
      if [[ -n "$config_root" ]]; then
        (cd "$config_root" && npx eslint --fix "$abs_file" 2>&1) || true
      fi
    fi
    ;;
  *.py)
    if command -v uvx >/dev/null 2>&1; then
      uvx ruff check --fix "$file" 2>&1 || true
    fi
    ;;
esac