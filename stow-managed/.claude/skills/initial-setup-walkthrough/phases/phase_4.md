# Phase 4: Stow

Stow must be invoked from the repo root using the bare package name. Passing a full path (e.g. `~/Repos/dotfiles/stow-managed/`) causes a "Slashes are not permitted in package names" error.

**Always simulate before applying.**

## Read state
```bash
. /tmp/initial-setup-walkthrough-state.txt && echo "REPO_DIR=$REPO_DIR"
```

## Simulate
```bash
. /tmp/initial-setup-walkthrough-state.txt && cd "$REPO_DIR" && stow -v --simulate -t ~ stow-managed
```

Review the output before proceeding:
- Lines starting with `LINK:` — symlinks stow will create (expected)
- `CONFLICT` warnings — a file already exists that stow can't replace; back it up and remove it, then re-run the simulation
- `FOREIGN_SYMLINK` entries — symlinks pointing to another repo or local dir; leave these alone, they are intentionally managed elsewhere

## Apply
Only proceed if the simulation output was clean.

```bash
. /tmp/initial-setup-walkthrough-state.txt && cd "$REPO_DIR" && stow -v -t ~ stow-managed
```

## Confirm
Spot-check a few key symlinks:
```bash
ls -la ~/.zshrc ~/.tmux.conf ~/.gitconfig ~/.claude/settings.json 2>/dev/null
```

Each should be a symlink pointing into the repo's `stow-managed/` directory.

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 4 done
```
