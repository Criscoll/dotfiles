# Stage: Execute

Writes `$RESYNC_DIR/log.md`. Reads `HOME_DIR`, `REPO_DIR`, and `RESYNC_DIR` from context (SKILL.md Step 0).

## Determine execution path

```bash
[ -f "$RESYNC_DIR/plan.md" ] && echo "plan.md present" || echo "fast-sync path (no plan.md)"
```

- **plan.md present** → read it and execute against its decisions: skip to [Full execution path](#full-execution-path)
- **No plan.md (fast-sync)** → proceed to [Fast-sync path](#fast-sync-path)

---

## Fast-sync path

Applies only when triage.md has `Fast-sync eligible: YES` and no plan.md exists. Only MISSING_LOCALLY items are present — stow never clobbers.

```bash
cat "$RESYNC_DIR/triage.md"
```

**FS1: Verify guard directories are real directories**

```bash
for d in commands agents skills hooks; do
  path="$HOME_DIR/.claude/$d"
  if [ -L "$path" ]; then
    echo "SYMLINK (must resolve first): $path -> $(readlink "$path")"
  elif [ -d "$path" ]; then
    echo "OK: $path"
  else
    echo "MISSING — will create: $path"
  fi
done
```

Create any that are missing:

```bash
mkdir -p "$HOME_DIR/.claude/commands" "$HOME_DIR/.claude/agents" "$HOME_DIR/.claude/skills" "$HOME_DIR/.claude/hooks"
```

If any are symlinks — **stop** and flag for manual resolution before proceeding.

**FS2: Surface .stow-local-ignore**

```bash
if [ -f "$REPO_DIR/stow-managed/.stow-local-ignore" ]; then
  echo "Active exclusions:"; cat "$REPO_DIR/stow-managed/.stow-local-ignore"
else
  echo "No .stow-local-ignore — all managed files will be linked."
fi
```

**FS3: Simulate and confirm**

```bash
cd "$REPO_DIR" && stow -v --simulate -t "$HOME_DIR" stow-managed
```

Show `LINK:` lines to the user. Ask for confirmation before applying.

**FS4: Apply and spot-check**

```bash
cd "$REPO_DIR" && stow -v -t "$HOME_DIR" stow-managed
```

```bash
ls -la "$HOME_DIR/.zshrc" "$HOME_DIR/.tmux.conf" 2>/dev/null || true
```

If triage.md listed COLLAPSIBLE entries, offer to run `collapsible_dirs.sh` and then `collapse_dir.sh` for each approved directory. Do not collapse without explicit user approval.

Skip to [Canonical verify](#canonical-verify).

---

## Full execution path

Read the approved plan:

```bash
cat "$RESYNC_DIR/plan.md"
```

Work through each item. Do not act on items not approved or explicitly deferred.

### Before anything: verify guard directories

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
mkdir -p "$HOME_DIR/.claude/commands" "$HOME_DIR/.claude/agents" "$HOME_DIR/.claude/skills"
```

If any are symlinks — **stop**. Flag for manual resolution.

### CLEAN_APPLY and MISSING_LOCALLY

Before removing any local file, run `safe_remove.sh` to validate targets don't resolve into the repo:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/safe_remove.sh" "$HOME_DIR" "$REPO_DIR" \
  "rel/path/file1" "rel/path/file2"
```

If `safe_remove.sh` reports `ABORT` for any file: reclassify as `SYMLINKED_VIA_DIR` — do not remove.

Simulate then apply:

```bash
cd "$REPO_DIR" && stow -v --simulate -t "$HOME_DIR" stow-managed
cd "$REPO_DIR" && stow -v -t "$HOME_DIR" stow-managed
```

Do not use `--adopt` on a read-only device — it writes local files into the repo.

### LOCAL_MIGRATION

For each file:
1. Create the `.local` variant (`.zshrc` → `~/.zshrc.local`, `.gitconfig` → `~/.gitconfig.local`, etc.)
2. Extract machine-specific and sensitive content into the `.local` file
3. Verify the main config sources its `.local` variant; add the source line if missing:
   ```bash
   grep -n "local" "$HOME_DIR/<file>" | head -5
   ```
4. Run `safe_remove.sh` for that file, then stow

### CONFLICT

Act only on items with a recorded `// decision:` in plan.md. No recorded decision → treat as defer.

**Take repo:**
```bash
BACKUP_DIR="/tmp/resync-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR/$(dirname <rel/path>)"
cp -a "$HOME_DIR/<file>" "$BACKUP_DIR/<rel/path>"
echo "Backed up to $BACKUP_DIR/<rel/path>"
```
Verify backup contains everything from the local version, then `safe_remove.sh` and stow.

**Take local:** Do not stow. Leave local version in place. Note as candidate for upstreaming from a primary device.

**Merge:** Align shared content with the repo version, extract machine-specific parts into a `.local` file, then treat as LOCAL_MIGRATION.

**Defer:** Skip. Note in log.

### LOCAL_ONLY_ADDITIONS

- Machine-specific content → move to a `.local` file, then stow
- Generic content → flag for upstreaming from a primary device; do not modify the repo from this machine

### COLLAPSIBLE_DIR

For each directory the user approved to collapse:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/collapse_dir.sh" "$HOME_DIR" "$REPO_DIR" "rel/path/to/dir"
```

The script aborts if any local-only file is found in the subtree. Run one directory at a time and verify before the next. Collapsing a parent handles its subdirectories — do not run on subdirectories separately.

### SENSITIVE_IN_REPO

Do not apply these files. Flag them prominently in log.md. The issue must be fixed in the repo before syncing further.

### After each stow operation

```bash
ls -la "$HOME_DIR/<file>"
```

Should point into `$REPO_DIR/stow-managed/`.

---

## Canonical verify

```bash
dotfiles-audit --no-color --fails && dotfiles-diff --no-color --summary
```

---

## Write log.md

Use the Write tool to create `$RESYNC_DIR/log.md`:

```markdown
# Resync Log
> Stage: execute — complete

Machine: <hostname>
Completed: <date>

## Applied
[List files now symlinked, or "none"]

## Migrated to .local
[List local migrations performed, or "none"]

## Conflicts resolved
[How each conflict was resolved, or "none"]

## Deferred
[What was skipped and why, or "none"]

## Sensitive flags (pending repo-side remediation)
[List any SENSITIVE_IN_REPO items, or "none"]

## Final audit
<paste dotfiles-audit --fails output>
```

## End of stage

Tell the user:

> Sync complete. Log written to `.resync/log.md`.
>
> To re-run any stage: `/resync-dotfiles <stage-name>` (e.g. `/resync-dotfiles triage`).
> To start fresh: delete `.resync/` and re-invoke `/resync-dotfiles`.
