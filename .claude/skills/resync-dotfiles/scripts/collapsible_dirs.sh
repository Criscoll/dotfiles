#!/usr/bin/env bash
# collapsible_dirs.sh — detect directories that stow could collapse into a single symlink.
#
# Usage:
#   bash collapsible_dirs.sh HOME_DIR REPO_DIR
#
# Output (stdout): lines of the form  COLLAPSIBLE_DIR<TAB>rel/path
#
# A directory is COLLAPSIBLE if:
#   - it exists as a real directory on the machine (not a symlink)
#   - it is not accessed through a parent that is already a repo symlink
#   - it contains no local-only files anywhere in its subtree
#   - it has no direct child directory-symlinks into the repo (mixed containers)
#
# Only the shallowest collapsible directory in each subtree is reported;
# subdirectories suppressed when a parent is also collapsible.
#
# Side effects:
#   Writes /tmp/resync-collapsible-dirs.txt — one rel path per line

set -euo pipefail

HOME_DIR="${1:?Usage: collapsible_dirs.sh HOME_DIR REPO_DIR}"
REPO_DIR="${2:?Usage: collapsible_dirs.sh HOME_DIR REPO_DIR}"
STOW_DIR="$REPO_DIR/stow-managed"

if [[ ! -d "$STOW_DIR" ]]; then
  echo "ERROR: stow-managed directory not found at $STOW_DIR" >&2
  exit 1
fi

portable_realpath() {
  if command -v realpath >/dev/null 2>&1; then
    realpath "$1"
  else
    python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$1"
  fi
}

is_under_repo_symlink() {
  local target="$1"
  local check
  check="$(dirname "$target")"
  while [[ "$check" != "/" && "$check" != "$HOME_DIR" ]]; do
    if [[ -L "$check" ]]; then
      local resolved
      resolved="$(portable_realpath "$check")"
      if [[ "$resolved" == "$REPO_DIR"* ]]; then
        return 0
      fi
    fi
    check="$(dirname "$check")"
  done
  return 1
}

: > /tmp/resync-collapsible-dirs.txt

declare -a _collapsible=()

while IFS= read -r src_dir; do
  rel_dir="${src_dir#$STOW_DIR/}"
  target_dir="$HOME_DIR/$rel_dir"

  [[ -d "$target_dir" ]] || continue
  [[ -L "$target_dir" ]] && continue

  is_under_repo_symlink "$target_dir" && continue

  # Skip mixed containers — real dirs that hold direct child dir-symlinks into the repo
  # (e.g. ~/.claude/skills/ with resync-dotfiles/ as a dir-symlink).
  # Collapsing them would eliminate room for local-only entries.
  is_mixed_container=false
  while IFS= read -r entry; do
    if [[ -L "$entry" && -d "$entry" ]]; then
      resolved="$(portable_realpath "$entry" 2>/dev/null || true)"
      if [[ -n "$resolved" && "$resolved" == "$REPO_DIR"* ]]; then
        is_mixed_container=true
        break
      fi
    fi
  done < <(find "$target_dir" -maxdepth 1 -mindepth 1 2>/dev/null)
  $is_mixed_container && continue

  local_only=0
  while IFS= read -r f; do
    if [[ -L "$f" ]]; then
      resolved="$(portable_realpath "$f" 2>/dev/null || true)"
      if [[ -z "$resolved" || "$resolved" != "$REPO_DIR"* ]]; then
        local_only=$((local_only + 1))
      fi
    else
      local_only=$((local_only + 1))
    fi
  done < <(find "$target_dir" -not -type d 2>/dev/null)

  if (( local_only == 0 )); then
    _collapsible+=("$rel_dir")
  fi
done < <(find "$STOW_DIR" -mindepth 1 -type d \
  | grep -v -E '/(\.git|powerlevel10k|\.tmux/plugins)/' \
  | sort)

for rel_dir in "${_collapsible[@]}"; do
  is_subdir=false
  for other in "${_collapsible[@]}"; do
    if [[ "$rel_dir" != "$other" && "$rel_dir" == "$other/"* ]]; then
      is_subdir=true
      break
    fi
  done
  if ! $is_subdir; then
    printf 'COLLAPSIBLE_DIR\t%s\n' "$rel_dir"
    echo "$rel_dir" >> /tmp/resync-collapsible-dirs.txt
  fi
done
