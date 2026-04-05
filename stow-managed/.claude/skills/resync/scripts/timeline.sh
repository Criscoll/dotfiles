#!/usr/bin/env bash
# timeline.sh — compare repo commit date vs local mtime for EXISTS_LOCALLY files.
#
# Usage:
#   bash timeline.sh HOME_DIR REPO_DIR
#
# Input:  reads /tmp/resync-exists-locally.txt (written by inventory.sh)
# Output: TSV with columns:  REL_PATH  REPO_DATE  LOCAL_DATE  NEWER
#
# NEWER values:
#   REPO    — repo has a more recent commit than the local file's mtime
#   LOCAL   — local file is newer than the last repo commit
#   SAME    — timestamps match within 60 seconds (likely committed from local)
#   UNKNOWN — could not determine (no git history or stat failed)

set -euo pipefail

HOME_DIR="${1:?Usage: timeline.sh HOME_DIR REPO_DIR}"
REPO_DIR="${2:?Usage: timeline.sh HOME_DIR REPO_DIR}"
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

if [[ ! -s "$INPUT" ]]; then
  echo "# No EXISTS_LOCALLY files to analyse."
  exit 0
fi

while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue

  target="$HOME_DIR/$rel"

  repo_date_raw=$(git -C "$REPO_DIR" log --follow -1 --format="%ai" -- "stow-managed/$rel" 2>/dev/null || true)
  local_epoch=$(stat -c "%Y" "$target" 2>/dev/null || true)
  local_date_human=$(stat -c "%y" "$target" 2>/dev/null | cut -d. -f1 || true)

  if [[ -z "$repo_date_raw" || -z "$local_epoch" ]]; then
    newer="UNKNOWN"
    repo_date_raw="${repo_date_raw:-not in git}"
    local_date_human="${local_date_human:-not found}"
  else
    repo_epoch=$(date -d "$repo_date_raw" +%s 2>/dev/null || echo 0)
    diff_secs=$(( local_epoch - repo_epoch ))
    if (( diff_secs > 60 )); then
      newer="LOCAL"
    elif (( diff_secs < -60 )); then
      newer="REPO"
    else
      newer="SAME"
    fi
  fi

  printf '%s\t%s\t%s\t%s\n' "$rel" "$repo_date_raw" "$local_date_human" "$newer"
done < "$INPUT"
