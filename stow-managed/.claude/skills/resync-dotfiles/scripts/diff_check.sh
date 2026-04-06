#!/usr/bin/env bash
# diff_check.sh — diff EXISTS_LOCALLY files against repo versions.
#
# Usage:
#   bash diff_check.sh HOME_DIR REPO_DIR
#
# Input:  reads /tmp/resync-exists-locally.txt (written by inventory.sh)
# Output:
#   Summary line per file: IDENTICAL or DIFFERS, followed by the diff if different.
#   A final "## Sensitive scan" section scanning stow-managed/ for credential patterns.
#
# The diff section feeds Phase 3 analysis.
# The sensitive scan section feeds Phase 4 analysis.

set -euo pipefail

HOME_DIR="${1:?Usage: diff_check.sh HOME_DIR REPO_DIR}"
REPO_DIR="${2:?Usage: diff_check.sh HOME_DIR REPO_DIR}"
INPUT="/tmp/resync-exists-locally.txt"

if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: $INPUT not found — run inventory.sh first" >&2
  exit 1
fi

# Warn if the temp file is older than the audit file (likely stale from a previous run).
AUDIT="/tmp/resync-audit.md"
if [[ -f "$AUDIT" && "$INPUT" -ot "$AUDIT" ]]; then
  echo "WARNING: $INPUT is older than $AUDIT — it may be stale from a previous run." >&2
  echo "         Re-run inventory.sh if results look wrong." >&2
fi

echo "## Diff Results"
echo ""

if [[ ! -s "$INPUT" ]]; then
  echo "No EXISTS_LOCALLY files to diff."
else
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue

    target="$HOME_DIR/$rel"
    repo_file="$REPO_DIR/stow-managed/$rel"

    if diff -q "$target" "$repo_file" &>/dev/null; then
      echo "IDENTICAL  $rel"
    else
      echo "DIFFERS    $rel"
      diff "$target" "$repo_file" | head -40
      echo "---"
    fi
  done < "$INPUT"
fi

echo ""
echo "## Sensitive Scan (stow-managed/)"
echo ""

# Exclude binary files, submodule internals, known large directories, and the
# resync skill's own phase files (which contain example patterns as documentation).
GREP_EXCLUDES=(
  --binary-files=without-match
  --exclude-dir='.git'
  --exclude-dir='powerlevel10k'
  --exclude-dir='.tmux'
  --exclude-dir='resync'
)

hits=$(
  grep -rn "${GREP_EXCLUDES[@]}" \
    -iE "(api_key|api_token|auth_token|password|secret|credential|private_key)\s*=" \
    "$REPO_DIR/stow-managed/" 2>/dev/null || true
)

hits2=$(
  grep -rn "${GREP_EXCLUDES[@]}" \
    -E "(token\s*=|password\s*=|secret\s*=)" \
    "$REPO_DIR/stow-managed/" 2>/dev/null || true
)

combined=$(printf '%s\n%s' "$hits" "$hits2" | grep -v '^\s*$' | sort -u || true)

if [[ -z "$combined" ]]; then
  echo "CLEAN — no credential patterns found."
else
  echo "POSSIBLE SECRETS FOUND — review before proceeding:"
  echo "$combined"
fi
