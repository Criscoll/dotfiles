# Scenario: File appears local but parent directory is a repo symlink

A file looks like a real local file, but its parent directory is a symlink into the repo. The file is effectively in sync — it lives inside the repo via the directory symlink. It is `SYMLINKED_VIA_DIR`.

Do not treat it as a local file needing migration. Do not remove it. Leave it alone.

## Confirm

Walk up the directory tree from the file and check each parent for a symlink into the repo:

```bash
file="$HOME_DIR/<rel/path/to/file>"
check="$(dirname "$file")"
while [ "$check" != "/" ] && [ "$check" != "$HOME_DIR" ]; do
  if [ -L "$check" ]; then
    resolved=$(readlink -f "$check" 2>/dev/null || python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$check")
    echo "Parent symlink: $check -> $resolved"
    [[ "$resolved" == "$REPO_DIR"* ]] && echo "SYMLINKED_VIA_DIR: file is in sync via parent"
    break
  fi
  check="$(dirname "$check")"
done
```

If a parent resolves into `$REPO_DIR`, the file is already managed by the repo. It only appears real because you're looking through a directory symlink.

## Why this happens

When a directory in `stow-managed/` had no local-only files in it, stow collapsed the whole directory into a single directory symlink (e.g. `~/.config/nvim/ -> ../Repos/dotfiles/stow-managed/.config/nvim/`). All files inside appear local but are actually inside the repo.

## When to collapse vs leave as-is

If the directory is `SYMLINKED_VIA_DIR` and you want to add local-only files inside it later, you'd need to break the directory symlink first (convert it back to a real directory with individual file symlinks). That is a deliberate choice — the full `/resync-dotfiles` skill handles this as a `COLLAPSIBLE_DIR` decision.

For triage purposes: if the file is confirmed `SYMLINKED_VIA_DIR`, it is not a problem. Move on.
