---
name: resync-triage
description: Investigate and resolve dotfiles sync problems — merge conflicts after git pull, stow collisions, broken symlinks, guard directory issues, or unexpected drift between the repo and the local machine
allowed-tools: Bash Read Glob Grep Edit Write
---

You are triaging a dotfiles sync problem. Diagnose first, then load only the scenario files that apply. Do not read scenario files speculatively.

## Step 1: Orientation

```bash
realpath ~
for p in ~/Repos/dotfiles ~/dotfiles ~/src/dotfiles ~/.dotfiles; do
  [ -d "$p/stow-managed" ] && echo "Found: $(realpath $p)"
done
```

Hold `HOME_DIR` and `REPO_DIR` for all subsequent commands.

## Step 2: Pull-only machines — stash, pull, pop

If the machine has uncommitted changes (config drift, local edits to tracked files), pull will fail or produce conflicts. The standard process:

```bash
# Check for uncommitted changes
git -C $REPO_DIR status --short

# If there are changes, stash them
git -C $REPO_DIR stash push -m "pre-pull drift $(date +%Y%m%d-%H%M%S)"

# Pull
git -C $REPO_DIR pull

# Pop the stash and see what happens
git -C $REPO_DIR stash pop
```

**After the pop:**
- Clean pop → the local changes were compatible with what came down; proceed to Step 3.
- Conflicts after pop → the stashed changes conflict with the new repo state; proceed to Step 3 and load `scenarios/merge_conflicts.md`. The stash pop leaves conflict markers in the files just like a merge conflict.
- If the pop looks wrong and you want to abort, drop the stash and start fresh from the pulled state: `git -C $REPO_DIR checkout -- .` (only after confirming the stash is backed up and nothing local is worth keeping).

This machine is pull-only — do not commit or push regardless of outcome.

## Step 3: Diagnose

```bash
# Merge conflicts in the repo?
git -C $REPO_DIR diff --name-only --diff-filter=U 2>/dev/null

# Stow warnings or collisions?
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 | grep -iE 'conflict|warning|error|existing target'

# Guard directory problems?
for d in commands agents skills; do
  p="$HOME_DIR/.claude/$d"
  [ -L "$p" ] && echo "SYMLINK_GUARD: $d -> $(readlink "$p")"
  [ ! -e "$p" ] && echo "MISSING_GUARD: $d"
done
```

Match what you see to the table, then load the file(s) that apply.

## Step 4: Load scenario guidance

| Symptom | Load |
|---|---|
| Conflict markers in tracked files after `git pull` | `scenarios/merge_conflicts.md` |
| Stow "existing target is neither a link nor empty dir" | `scenarios/stow_collision.md` |
| Guard dir (`.claude/skills`, `.claude/agents`, etc.) is a symlink | `scenarios/guard_directory.md` |
| Symlink at a stow target path pointing outside this repo | `scenarios/foreign_symlink.md` |
| Tracked config file has machine-specific or sensitive content | `scenarios/local_bleed.md` |
| File appears local but its parent directory is a repo symlink | `scenarios/symlinked_via_dir.md` |
| `settings.local.json` missing or stale after a fresh stow | `scenarios/settings_drift.md` |

```bash
# Example: load only what applies
cat "${CLAUDE_SKILL_DIR}/scenarios/merge_conflicts.md"
```

Handle scenarios in the order listed if multiple apply (git state before stow state).

## Invariants — always apply regardless of scenario

- Never `stow --adopt` on a read-only (pull-only) machine — it writes local files into the repo.
- Never overwrite a `FOREIGN_SYMLINK` — it is managed by another system.
- Always simulate before applying stow: `stow -v --simulate -t $HOME_DIR stow-managed`.
- Guard dirs must be real directories, not symlinks, before stow runs.
- Machine-specific content belongs in `.local` files — not in tracked config.
- Do not commit from this machine unless push access is confirmed.
- Use `[ -L "$path" ]` to test for symlinks — not `ls -la "$path/"` (trailing slash follows the link).
