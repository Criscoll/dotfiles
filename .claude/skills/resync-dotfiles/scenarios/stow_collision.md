# Scenario: Stow collision

Stow refuses to create a symlink because a real (non-symlink) file already exists at the target path.

> **Many collisions at once?** If the collision count is high (more than ~5) or the machine
> has never been stowed, stop here and load `scenarios/cold_start.md` instead. That scenario
> covers batch triage — handling collisions one-by-one at scale is error-prone.

```
WARNING! stowing stow-managed would cause conflicts:
  * existing target is neither a link nor empty dir: .zshrc
```

## Identify all collisions

```bash
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 | grep "existing target"
```

## For each colliding file

**1. Confirm it is a real file, not a broken symlink:**
```bash
ls -la $HOME_DIR/<file>     # -L would show a symlink; a real file has no -> 
```

**2. Compare with the repo version:**
```bash
diff $HOME_DIR/<file> $REPO_DIR/stow-managed/<file>
```

**Classify the diff:**

| Result | Action |
|---|---|
| Identical | Safe to remove and stow |
| Repo is a superset of local | Safe to remove and stow (local has nothing new) |
| Local has additions | Extract machine-specific content to `.local` first, then remove and stow |
| Conflicting values | Present to user before acting |

## Resolution

**Back up before removing:**
```bash
BACKUP="/tmp/stow-collision-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/$(dirname <rel/path>)"
cp -a $HOME_DIR/<file> "$BACKUP/<rel/path>"
echo "Backed up to $BACKUP"
```

**If local has additions, extract them first:**
See `scenarios/local_bleed.md` for the `.local` file pattern.

**Remove and stow:**
```bash
rm $HOME_DIR/<file>
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed   # verify first
cd $REPO_DIR && stow -v -t $HOME_DIR stow-managed
```

**Verify:**
```bash
ls -la $HOME_DIR/<file>   # should show -> <REPO_DIR>/stow-managed/<file>
```

## What not to do

- Do not use `stow --adopt` — on a read-only machine this moves the local file *into* the repo, which corrupts the shared config.
- Do not remove a file without backing it up and reading the diff first.
