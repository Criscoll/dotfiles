# Phase 7: Execution

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md` and substitute them in all commands below.

Work through each approved item in the plan. Do not act on items the user has not approved or asked to skip.

## Before anything: verify guard directories

```bash
ls -la $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills
```

If any are missing, create them:
```bash
mkdir -p $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills
```

If any are symlinks — **stop**. A folded symlink means stow previously treated the whole directory as a single unit, and local-only files cannot be added safely. Flag it for the user to resolve manually before proceeding.

---

## MISSING_LOCALLY and CLEAN_APPLY

Run a dry run first:
```bash
stow -v --simulate -t $HOME_DIR $REPO_DIR/stow-managed/
```

Review the output. If the dry run looks correct, apply:
```bash
stow -v -t $HOME_DIR $REPO_DIR/stow-managed/
```

Note: stow applies the entire package at once. If any items in the plan should be excluded from this run, handle them individually rather than running a full stow.

---

## LOCAL_MIGRATION

For each file:

1. Create the `.local` variant:
   - `.zshrc` → `~/.zshrc.local`
   - `.gitconfig` → `~/.gitconfig.local`
   - Use the same pattern for any config file

2. Extract machine-specific and sensitive content from the local file into the `.local` file.

3. Check whether the main config file sources its `.local` variant. Most already do — verify with:
   ```bash
   grep -n "local" ~/<file> | head -5
   ```
   If sourcing is missing, add it before stowing.

4. Apply stow for that file.

---

## CONFLICT

Act only on items where the user has recorded a resolution in the approved plan. If no resolution is recorded, treat it as **defer**.

**Take repo:**
```bash
cp $HOME_DIR/<file> $HOME_DIR/<file>.bak   # back up first
```
Verify the backup contains everything from the local version, then stow.

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

## SENSITIVE_IN_REPO

Do not apply these files. Flag them and leave remediation to the user. The issue must be fixed in the repo before syncing further.

If any `SENSITIVE_IN_REPO` files exist, report `sensitive_blocked` — do not continue applying other files until this is resolved.

---

## After each stow operation

Verify each symlink:
```bash
ls -la $HOME_DIR/<file>
```

It should point back into `$REPO_DIR/stow-managed/`.

If stow reports a conflict (non-symlink file in the way): do not use `--adopt`. On a read-only device, `--adopt` moves the local file into the repo — that is wrong here. Instead, manually move or rename the conflicting file, then re-run stow.

---

## Next

```bash
# All items processed:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 7 done

# Halted due to sensitive data in repo:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 7 sensitive_blocked
```

Then fetch and execute the phase it returns.
