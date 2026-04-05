#!/usr/bin/env bash
# safe_remove.sh — remove local files only after verifying they do not resolve
# into the repo. Prevents accidental deletion of repo content through directory
# symlinks (e.g. ~/snap/neomutt -> repo/stow-managed/snap/neomutt).
#
# Usage:
#   bash safe_remove.sh HOME_DIR REPO_DIR rel/path/one rel/path/two ...
#
# Each argument after REPO_DIR is a path relative to HOME_DIR.
# Exits non-zero immediately if any target resolves inside REPO_DIR.

set -euo pipefail

HOME_DIR="${1:?Usage: safe_remove.sh HOME_DIR REPO_DIR [rel_path ...]}"
REPO_DIR="${2:?Usage: safe_remove.sh HOME_DIR REPO_DIR [rel_path ...]}"
shift 2

if [[ $# -eq 0 ]]; then
  echo "No files to remove."
  exit 0
fi

errors=0

# First pass: validate all targets before removing any.
for rel in "$@"; do
  target="$HOME_DIR/$rel"

  if [[ ! -e "$target" && ! -L "$target" ]]; then
    echo "SKIP (not found): $rel"
    continue
  fi

  real="$(realpath "$target")"
  if [[ "$real" == "$REPO_DIR"* ]]; then
    echo "ABORT: $target resolves to $real" >&2
    echo "       This path is inside the repo — removing it would delete a tracked file." >&2
    echo "       The file is already in sync via a directory symlink; no action needed." >&2
    errors=$((errors + 1))
  fi
done

if (( errors > 0 )); then
  echo "" >&2
  echo "Halted: $errors file(s) resolve inside REPO_DIR. No files were removed." >&2
  exit 1
fi

# Second pass: remove.
for rel in "$@"; do
  target="$HOME_DIR/$rel"
  if [[ ! -e "$target" && ! -L "$target" ]]; then
    continue
  fi
  rm "$target"
  echo "REMOVED: $rel"
done
