#!/usr/bin/env bash
set -euo pipefail

REPO_DIR=/workspace/dotfiles
HOME_DIR=/home/paseo
ORIG_ENTRYPOINT=/usr/local/bin/paseo-docker-entrypoint

if [[ ! -d "$REPO_DIR/stow-managed" ]]; then
  echo "[provision-agents] $REPO_DIR/stow-managed not found (is /workspace bind-mounted?) — skipping" >&2
  exec "$ORIG_ENTRYPOINT" "$@"
fi

echo "[provision-agents] creating guard directories"
# Docker auto-creates missing bind-mount sources as root:root, so a fresh
# volume (e.g. .pi on first run) isn't writable by paseo yet — create as
# root, then hand ownership back.
mkdir -p \
  "$HOME_DIR/.claude/commands" "$HOME_DIR/.claude/agents" \
  "$HOME_DIR/.claude/skills" "$HOME_DIR/.claude/hooks" \
  "$HOME_DIR/.pi/agent/extensions" "$HOME_DIR/.pi/agent/agents"
chown -R paseo:paseo "$HOME_DIR/.claude" "$HOME_DIR/.pi"

echo "[provision-agents] checking for stow conflicts"
conflicts="$(cd "$REPO_DIR" && gosu paseo stow -n -v -t "$HOME_DIR" stow-managed 2>&1 || true)"
while IFS= read -r rel; do
  [[ -z "$rel" ]] && continue
  target="$HOME_DIR/$rel"
  if [[ -e "$target" && ! -L "$target" ]]; then
    echo "[provision-agents] backing up pre-existing $target -> $target.bak"
    mv -f "$target" "$target.bak"
  fi
done < <(grep -oP '(?<=existing target is neither a link nor a directory: ).*' <<< "$conflicts")

echo "[provision-agents] running stow"
(cd "$REPO_DIR" && gosu paseo stow -v -t "$HOME_DIR" stow-managed)

exec "$ORIG_ENTRYPOINT" "$@"
