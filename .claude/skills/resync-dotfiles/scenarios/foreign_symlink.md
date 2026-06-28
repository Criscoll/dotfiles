# Scenario: Foreign symlink at risk

A `FOREIGN_SYMLINK` is a symlink at a stow target path that points somewhere *outside* this repo — typically managed by a work repo, a machine-specific repo, or another tool. These are intentional. Never overwrite them.

## Identify foreign symlinks

```bash
find $HOME_DIR -maxdepth 5 -type l 2>/dev/null | while IFS= read -r f; do
  target=$(readlink -f "$f" 2>/dev/null || python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$f")
  [[ "$target" != "$REPO_DIR"* ]] && echo "FOREIGN: $f -> $target"
done
```

Cross-reference with what stow would link:
```bash
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 | grep "existing target"
```

If a stow conflict points to a foreign symlink, stow is about to overwrite something managed by another system.

## Protection

Add the path to `.stow-local-ignore` in `stow-managed/` **on this machine only**. This file is gitignored — each machine keeps its own.

```bash
# Format: one regex pattern per line, relative to stow-managed/
# Example: to exclude .claude/skills/work-deploy from being stowed:
echo '^\.claude/skills/work-deploy' >> $REPO_DIR/stow-managed/.stow-local-ignore
```

Verify the pattern is correct by re-running the stow simulation:
```bash
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1
```

The conflict for that path should no longer appear.

## What counts as foreign

Foreign symlinks are expected in guard directories (`.claude/skills/`, `.claude/agents/`, `.claude/commands/`) where work-specific or machine-specific entries coexist alongside tracked ones. The inventory script in the full resync workflow classifies these as `FOREIGN_SYMLINK` and treats them as intentionally managed.

When in doubt about whether a foreign symlink is expected: ask the user before touching it.
