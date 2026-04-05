#!/usr/bin/env bash
# inventory.sh — classify all stow-managed files against the local machine.
#
# Usage:
#   bash inventory.sh HOME_DIR REPO_DIR
#
# Output (stdout): TSV with two columns:  CLASSIFICATION  REL_PATH
#
# Classifications:
#   SYMLINKED          — target is a symlink pointing into the repo (direct)
#   SYMLINKED_VIA_DIR  — a parent directory is a symlink into the repo;
#                        the file is effectively in sync but shows as a real file
#   EXISTS_LOCALLY     — target exists as a real file; needs diff/timeline analysis
#   MISSING_LOCALLY    — target does not exist on this machine
#   STOW_EXCLUDED      — stow will never link this file due to its built-in default
#                        exclusion list (e.g. .gitignore, .gitmodules); treat as
#                        unmanaged rather than truly "missing"
#
# Side effects:
#   Writes /tmp/resync-exists-locally.txt    — one rel path per line, EXISTS_LOCALLY only
#   Writes /tmp/resync-missing-locally.txt   — one rel path per line, MISSING_LOCALLY only
#   Writes /tmp/resync-collapsible-dirs.txt  — one rel path per line, COLLAPSIBLE_DIR only
#
# These temp files are consumed by timeline.sh, diff_check.sh, safe_remove.sh, and collapse_dir.sh.

set -euo pipefail

HOME_DIR="${1:?Usage: inventory.sh HOME_DIR REPO_DIR}"
REPO_DIR="${2:?Usage: inventory.sh HOME_DIR REPO_DIR}"
STOW_DIR="$REPO_DIR/stow-managed"

if [[ ! -d "$STOW_DIR" ]]; then
  echo "ERROR: stow-managed directory not found at $STOW_DIR" >&2
  exit 1
fi

# Stow's built-in default exclusion patterns (subset that matters in practice).
# Files matching these will never be linked by stow regardless of their presence.
STOW_EXCLUDED_PATTERNS=(
  '(^|/)\.gitignore$'
  '(^|/)\.gitmodules$'
  '(^|/)CVS$'
  '(^|/)\.cvsignore$'
  '(^|/)\.svn$'
  '^[^/]*~$'
)

is_stow_excluded() {
  local rel="$1"
  for pat in "${STOW_EXCLUDED_PATTERNS[@]}"; do
    if [[ "$rel" =~ $pat ]]; then
      return 0
    fi
  done
  return 1
}

# Walk up the directory tree from target to HOME_DIR; return 0 if any
# ancestor directory is itself a symlink pointing inside REPO_DIR.
is_under_repo_symlink() {
  local target="$1"
  local check
  check="$(dirname "$target")"
  while [[ "$check" != "/" && "$check" != "$HOME_DIR" ]]; do
    if [[ -L "$check" ]]; then
      local resolved
      resolved="$(realpath "$check")"
      if [[ "$resolved" == "$REPO_DIR"* ]]; then
        return 0
      fi
    fi
    check="$(dirname "$check")"
  done
  return 1
}

# Clear temp output files.
: > /tmp/resync-exists-locally.txt
: > /tmp/resync-missing-locally.txt
: > /tmp/resync-collapsible-dirs.txt

# ── File inventory ────────────────────────────────────────────────────────────

find "$STOW_DIR" -type f \
  | grep -v -E '/(\.git|powerlevel10k|\.tmux/plugins)/' \
  | sort \
  | while IFS= read -r src; do
    rel="${src#$STOW_DIR/}"
    target="$HOME_DIR/$rel"

    if is_stow_excluded "$rel"; then
      printf 'STOW_EXCLUDED\t%s\n' "$rel"
    elif [[ -L "$target" ]]; then
      printf 'SYMLINKED\t%s\n' "$rel"
    elif is_under_repo_symlink "$target"; then
      printf 'SYMLINKED_VIA_DIR\t%s\n' "$rel"
    elif [[ -e "$target" ]]; then
      printf 'EXISTS_LOCALLY\t%s\n' "$rel"
      echo "$rel" >> /tmp/resync-exists-locally.txt
    else
      printf 'MISSING_LOCALLY\t%s\n' "$rel"
      echo "$rel" >> /tmp/resync-missing-locally.txt
    fi
  done

# ── Directory structure check ─────────────────────────────────────────────────
#
# For each directory in stow-managed, check whether the corresponding target
# directory is a real directory (not a symlink). If it is, and if it contains
# no local-only files anywhere in its subtree, it is a COLLAPSIBLE_DIR —
# stow could replace it with a single directory symlink, which is cleaner and
# means new files added to the repo automatically appear on this machine.
#
# Only the shallowest collapsible directory in each subtree is reported;
# subdirectories that are themselves collapsible only because the parent is
# are suppressed (collapsing the parent handles them automatically).

printf '\n## Directory Structure\n\n'

# Build a list of all real directories that are collapsible.
# We store them in an array so we can filter to roots only afterward.
declare -a _collapsible=()

while IFS= read -r src_dir; do
  rel_dir="${src_dir#$STOW_DIR/}"
  target_dir="$HOME_DIR/$rel_dir"

  # Must be a real directory on this machine (not missing, not already a symlink).
  [[ -d "$target_dir" ]] || continue
  [[ -L "$target_dir" ]] && continue

  # Skip directories accessed through a parent that is already a repo symlink —
  # those are effectively in sync and can't be independently collapsed.
  is_under_repo_symlink "$target_dir" && continue

  # Skip directories that have direct child directory-symlinks pointing into the repo.
  # These are "mixed containers" — intentionally kept real to allow local-only entries
  # alongside repo-managed subdirectories (e.g. ~/.claude/skills/ holding both the
  # tracked resync/ dir-symlink and future local-only skills). Collapsing them would
  # eliminate that flexibility.
  is_mixed_container=false
  while IFS= read -r entry; do
    if [[ -L "$entry" && -d "$entry" ]]; then
      resolved="$(realpath "$entry" 2>/dev/null || true)"
      if [[ -n "$resolved" && "$resolved" == "$REPO_DIR"* ]]; then
        is_mixed_container=true
        break
      fi
    fi
  done < <(find "$target_dir" -maxdepth 1 -mindepth 1 2>/dev/null)
  $is_mixed_container && continue

  # Count files in the subtree that are not repo-managed symlinks.
  local_only=0
  while IFS= read -r f; do
    if [[ -L "$f" ]]; then
      resolved="$(realpath "$f" 2>/dev/null || true)"
      if [[ -z "$resolved" || "$resolved" != "$REPO_DIR"* ]]; then
        local_only=$((local_only + 1))
      fi
    else
      local_only=$((local_only + 1))
    fi
  done < <(find "$target_dir" -not -type d 2>/dev/null)

  if (( local_only == 0 )); then
    _collapsible+=("$rel_dir")
  else
    printf 'REAL_DIR_WITH_LOCAL\t%s\t(%d local-only file(s))\n' "$rel_dir" "$local_only"
  fi
done < <(find "$STOW_DIR" -mindepth 1 -type d \
  | grep -v -E '/(\.git|powerlevel10k|\.tmux/plugins)/' \
  | sort)

# Report only root-level collapsible directories (suppress entries whose
# parent directory is also collapsible — they're handled by collapsing the parent).
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

if [[ ${#_collapsible[@]} -eq 0 ]]; then
  printf 'All managed directories are already symlinked or contain local-only files.\n'
fi
