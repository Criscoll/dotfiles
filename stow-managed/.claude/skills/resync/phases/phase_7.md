# Phase 7: Execution

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md`.

Work through each approved item in the plan. Do not act on items the user has not approved or asked to skip.

---

## Before anything: verify guard directories

```bash
for d in commands agents skills; do
  path="$HOME_DIR/.claude/$d"
  if [ -L "$path" ]; then
    echo "SYMLINK: $path -> $(readlink "$path")  *** must resolve before stowing ***"
  elif [ -d "$path" ]; then
    echo "OK: $path"
  else
    echo "MISSING: $path"
  fi
done
```

Create any that are missing:
```bash
mkdir -p $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills
```

If any are symlinks — **stop**. A folded symlink means stow previously treated the whole directory as a single unit, and local-only files cannot coexist safely inside it. Flag for the user to resolve manually.

---

## CLEAN_APPLY — remove local files so stow can place symlinks

Before removing any file, run `safe_remove.sh`. It validates that each target does not resolve into the repo (guards against deletion through directory symlinks) and aborts the entire operation if any would:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/safe_remove.sh $HOME_DIR $REPO_DIR \
  "rel/path/file1" \
  "rel/path/file2"
```

If `safe_remove.sh` reports `ABORT` for any file: the file is already in sync via a directory symlink — reclassify it as `SYMLINKED_VIA_DIR` and do not remove it.

---

## MISSING_LOCALLY and CLEAN_APPLY — apply via stow

Run a dry run first. Note: stow must be invoked from the repo directory with the package name, not a path:

```bash
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed
```

Review the output:
- `LINK: ...` lines show what would be created — verify these match the plan
- No output (aside from the simulation warning) means the package is already fully in sync — this is correct and expected

If the dry run looks correct, apply:

```bash
cd $REPO_DIR && stow -v -t $HOME_DIR stow-managed
```

If stow reports a conflict (non-symlink file in the way that `safe_remove.sh` missed): do not use `--adopt`. On a read-only device, `--adopt` moves the local file into the repo — that is wrong here. Instead, investigate the conflict manually, then re-run.

---

## LOCAL_MIGRATION

For each file:

1. Create the `.local` variant:
   - `.zshrc` → `~/.zshrc.local`
   - `.gitconfig` → `~/.gitconfig.local`
   - Use the same pattern for any config file

2. Extract machine-specific and sensitive content from the local file into the `.local` file.

3. Check whether the main config file sources its `.local` variant:
   ```bash
   grep -n "local" $HOME_DIR/<file> | head -5
   ```
   If sourcing is missing, add it before stowing.

4. Run `safe_remove.sh` for that file, then stow.

---

## CONFLICT

Act only on items where the user has recorded a resolution in the approved plan. If no resolution is recorded, treat it as **defer**.

**Take repo:**
```bash
BACKUP_DIR="/tmp/resync-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/$(dirname <rel/path>)"
cp -a $HOME_DIR/<file> "$BACKUP_DIR/<rel/path>"
echo "Backed up to $BACKUP_DIR/<rel/path>"
```
Verify the backup contains everything from the local version, then run `safe_remove.sh` and stow.

**Take local:**
Do not stow. Leave the local version in place. If the content looks generic enough to share, note it as a candidate for upstreaming from a primary device — do not modify the repo from this machine.

**Merge:**
Produce a merged file: align shared content with the repo version, extract machine-specific parts into a `.local` file, then treat as LOCAL_MIGRATION and stow.

**Defer:**
Skip. Note the file in `/tmp/resync-audit.md`. Leave both versions untouched.

---

## LOCAL_ONLY_ADDITIONS

- Machine-specific content → move to a `.local` file, then stow
- Generic content → flag for upstreaming from a primary device; do not modify the repo from this machine

---

## COLLAPSIBLE_DIR — collapse fragmented directories

For each directory the user approved to collapse, run:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/collapse_dir.sh $HOME_DIR $REPO_DIR "rel/path/to/dir"
```

The script will:
1. Abort immediately if any local-only file is found anywhere in the subtree
2. Remove the real directory
3. Re-run stow to create the directory symlink
4. Verify the symlink was created

Run one directory at a time and verify before moving to the next. Collapsing a parent directory automatically handles all its subdirectories — do not run `collapse_dir.sh` on subdirectories separately.

---

## SENSITIVE_IN_REPO

Do not apply these files. Flag them and leave remediation to the user. The issue must be fixed in the repo before syncing further.

If any `SENSITIVE_IN_REPO` files exist, report `sensitive_blocked` — do not continue applying other files until this is resolved.

---

## After each stow operation

Verify each new symlink:
```bash
ls -la $HOME_DIR/<file>
```

It should point back into `$REPO_DIR/stow-managed/`.

---

## Next

```bash
# All items processed:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 7 done

# Halted due to sensitive data in repo:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 7 sensitive_blocked
```

Then fetch and execute the phase it returns.
