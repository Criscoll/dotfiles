#!/usr/bin/env bash
# collapse_dir.sh — replace a fragmented real directory with a stow directory symlink.
#
# A "fragmented" directory is one that stow previously walked into and linked
# files individually, rather than symlinking the directory as a whole. This
# happens when the directory already existed on the target machine. Collapsing it
# replaces the real directory with a single directory symlink, which is cleaner
# and means new files added to the repo automatically appear on this machine
# without needing to re-run stow.
#
# Usage:
#   bash collapse_dir.sh HOME_DIR REPO_DIR rel/path/to/dir
#
# Safety:
#   1. Verifies every file in the subtree resolves into REPO_DIR (aborts if any
#      local-only file is found — nothing is touched)
#   2. Verifies the directory exists in stow-managed/
#   3. Removes the real directory
#   4. Re-runs stow to create the directory symlink
#   5. Verifies the symlink was created

set -euo pipefail

HOME_DIR="${1:?Usage: collapse_dir.sh HOME_DIR REPO_DIR rel/path/to/dir}"
REPO_DIR="${2:?Usage: collapse_dir.sh HOME_DIR REPO_DIR rel/path/to/dir}"
REL_DIR="${3:?Usage: collapse_dir.sh HOME_DIR REPO_DIR rel/path/to/dir}"

target="$HOME_DIR/$REL_DIR"
repo_dir="$REPO_DIR/stow-managed/$REL_DIR"

# ── Pre-flight checks ─────────────────────────────────────────────────────────

if [[ -L "$target" ]]; then
  echo "Already a symlink: $target"
  echo "$(readlink -f "$target")"
  exit 0
fi

if [[ ! -d "$target" ]]; then
  echo "ERROR: $target does not exist or is not a directory" >&2
  exit 1
fi

if [[ ! -d "$repo_dir" ]]; then
  echo "ERROR: $repo_dir not found in stow-managed — cannot collapse" >&2
  exit 1
fi

# ── Verify no local-only content ─────────────────────────────────────────────

echo "Scanning $target for local-only files..."

local_only=0
while IFS= read -r f; do
  if [[ -L "$f" ]]; then
    resolved="$(realpath "$f")"
    if [[ "$resolved" != "$REPO_DIR"* ]]; then
      echo "  LOCAL-ONLY (external symlink): $f -> $resolved" >&2
      local_only=$((local_only + 1))
    fi
  else
    echo "  LOCAL-ONLY (real file): $f" >&2
    local_only=$((local_only + 1))
  fi
done < <(find "$target" -not -type d 2>/dev/null)

if (( local_only > 0 )); then
  echo "" >&2
  echo "ABORT: $local_only local-only file(s) found in $target." >&2
  echo "       Move them elsewhere before collapsing this directory." >&2
  exit 1
fi

echo "All files verified as repo-managed symlinks."

# ── Collapse ──────────────────────────────────────────────────────────────────

BACKUP_DIR="/tmp/resync-backup-$(date +%Y%m%d-%H%M%S)"
echo "Backing up $target to $BACKUP_DIR/$REL_DIR"
mkdir -p "$BACKUP_DIR/$(dirname "$REL_DIR")"
cp -a "$target" "$BACKUP_DIR/$REL_DIR"
echo "Backup complete."

echo "Removing: $target"
rm -rf "$target"

echo "Running stow..."
cd "$REPO_DIR" && stow -v -t "$HOME_DIR" stow-managed

# ── Verify ───────────────────────────────────────────────────────────────────

if [[ -L "$HOME_DIR/$REL_DIR" ]]; then
  echo ""
  echo "OK: $HOME_DIR/$REL_DIR -> $(readlink "$HOME_DIR/$REL_DIR")"
else
  echo "" >&2
  echo "ERROR: stow did not create a symlink at $HOME_DIR/$REL_DIR" >&2
  echo "       Check stow output above for conflicts." >&2
  exit 1
fi
