# Scenario: Guard directory is a symlink

Guard directories are `.claude/commands`, `.claude/agents`, and `.claude/skills`. They must exist as **real directories** — not symlinks — so that tracked files (symlinked from the repo) and local-only files (untracked) can coexist inside them.

If a guard dir is a symlink, stow previously folded the entire directory into a single link because it was empty. Local-only entries cannot safely live inside a symlink.

## Confirm the problem

```bash
for d in commands agents skills; do
  p="$HOME_DIR/.claude/$d"
  if [ -L "$p" ]; then
    echo "SYMLINK: $p -> $(readlink "$p")"
  elif [ -d "$p" ]; then
    echo "OK: $p"
  else
    echo "MISSING: $p"
  fi
done
```

Use `[ -L "$p" ]` — not `ls -la "$p/"`. A trailing slash follows the symlink and makes it look like a real directory.

## Fix a symlinked guard dir

**First, see what's inside (via the symlink):**
```bash
ls -la $HOME_DIR/.claude/<dir>/
```

These files are inside the repo — they will be re-linked individually after the fix.

**Remove the symlink and create a real directory:**
```bash
rm $HOME_DIR/.claude/<dir>
mkdir -p $HOME_DIR/.claude/<dir>
```

**Re-stow to place individual file symlinks inside:**
```bash
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed
cd $REPO_DIR && stow -v -t $HOME_DIR stow-managed
```

**Verify individual symlinks were created:**
```bash
ls -la $HOME_DIR/.claude/<dir>/
# Each entry should show -> <REPO_DIR>/stow-managed/.claude/<dir>/<file>
```

## Fix a missing guard dir

```bash
mkdir -p $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed
cd $REPO_DIR && stow -v -t $HOME_DIR stow-managed
```

## After the fix

Any local-only files (skills, agents, commands not in this repo) can now be placed directly inside the real directory alongside the symlinks. They will not be tracked by git.
