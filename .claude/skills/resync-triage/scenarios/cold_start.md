# Scenario: Cold start — first-time stow on an unstowed machine

This machine has never had stow applied, or stow was removed. Every config file the repo
manages exists as a real file on disk, not a symlink — every stow target is a collision.
Work through the phases in order. Do not run stow until Phases 1–3 are complete.

---

## Phase 1: Scope assessment — understand the full picture before acting

```bash
# How many stow collisions will there be?
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 | grep "existing target" | wc -l

# List them
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 | grep "existing target"

# How far behind is the repo?
git -C $REPO_DIR fetch origin
git -C $REPO_DIR log --oneline HEAD..origin/main | wc -l   # commits behind
git -C $REPO_DIR diff --stat HEAD...origin/main            # what changed upstream

# Guard directory state
for d in commands agents skills; do
  p="$HOME_DIR/.claude/$d"
  [ -L "$p" ] && echo "SYMLINK_GUARD: $d -> $(readlink "$p")"
  [ ! -e "$p" ] && echo "MISSING_GUARD: $d"
  [ -d "$p" ] && ! [ -L "$p" ] && echo "OK: $d"
done
```

Review the counts before proceeding. If there are more than ~10 DIFFERS collisions or the git
log shows major structural changes upstream, plan the work in phases and do not rush.

---

## Phase 2: Pre-stow setup

Complete this checklist in order. These steps must happen before stow runs.

### 2a. Create guard directories as real directories

```bash
mkdir -p $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills
```

If stow runs before these exist, it folds each into a single directory symlink — leaving no
room for local-only files alongside tracked ones. Creating them first forces stow to place
individual file symlinks inside instead.

### 2b. Create machine-specific exclusions (.stow-local-ignore)

If this machine should not receive all managed files (e.g. no mail tools on a Mac, missing
dependencies for some configs), create a `.stow-local-ignore` in `stow-managed/`. This file
is gitignored — each machine keeps its own version.

```bash
# Format: one regex per line, relative to stow-managed/
# Examples:
#   ^snap/neomutt
#   ^\.mbsyncrc
#   ^\.config/msmtp
$EDITOR $REPO_DIR/stow-managed/.stow-local-ignore
```

Re-run the simulation after editing to confirm exclusions are applied:

```bash
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 | grep "existing target"
```

### 2c. Create runtime directories stow does not manage

```bash
# For the lazy.nvim lockfile (nvim users)
mkdir -p $HOME_DIR/.local/share/nvim
```

---

## Phase 3: Git — get the repo clean and current first

Git state before stow state. Do not run stow with an unclean repo.

```bash
# Stash any uncommitted repo changes
git -C $REPO_DIR status --short
git -C $REPO_DIR stash push -m "pre-cold-start $(date +%Y%m%d-%H%M%S)"

# Pull
git -C $REPO_DIR pull

# Pop
git -C $REPO_DIR stash pop
```

If the pop produces conflicts, resolve them before continuing. Load `scenarios/merge_conflicts.md`.

```bash
# Repo must be clean before Phase 4
git -C $REPO_DIR status
```

---

## Phase 4: Batch collision triage

With many collisions, categorize first — act second.

### 4a. Categorize all collisions

```bash
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1 \
  | grep "existing target" \
  | sed 's/.*existing target is neither a link nor empty dir: //' \
  | while IFS= read -r f; do
      local_file="$HOME_DIR/$f"
      repo_file="$REPO_DIR/stow-managed/$f"
      if diff -q "$local_file" "$repo_file" > /dev/null 2>&1; then
        echo "IDENTICAL:  $f"
      else
        echo "DIFFERS:    $f"
      fi
    done
```

### 4b. IDENTICAL files — safe to remove

No content is lost. Back up as a batch, then remove:

```bash
BACKUP="/tmp/cold-start-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"
# Repeat for each IDENTICAL file:
cp -a "$HOME_DIR/<file>" "$BACKUP/"
rm "$HOME_DIR/<file>"
```

### 4c. DIFFERS files — read each diff before acting

```bash
diff "$HOME_DIR/<file>" "$REPO_DIR/stow-managed/<file>"
```

Classify each diff using the rules in `scenarios/merge_conflicts.md`:

| Diff result | Action |
|---|---|
| Machine-specific content on local side | Extract to `.local` file, then remove and stow |
| Functionally identical (local had it first) | Take repo version — discard local |
| Both sides generic, local is better | Note as upstream candidate; take repo for now |
| Incompatible values | Present to user before acting |

Do not remove a DIFFERS file until its local-only content (if any) has been extracted to a
`.local` file.

### 4d. Prioritization for large collision sets

If there are many DIFFERS files, work in this order:

1. Shell config (`.zshrc`, `.bashrc`) — sourced on every shell open; get this right first
2. Git config (`.gitconfig`) — identity, signing key, credential helper
3. Editor config (`nvim/`) — important but contained; won't break the shell
4. Everything else

---

## Phase 5: Run stow

```bash
# Simulate — must be clean before applying
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed

# Apply
cd $REPO_DIR && stow -v -t $HOME_DIR stow-managed

# Spot-check key symlinks
ls -la $HOME_DIR/.zshrc $HOME_DIR/.gitconfig $HOME_DIR/.config/nvim/init.lua
```

If stow still reports collisions after triage, a DIFFERS file was missed. Go back to Phase 4c.

---

## Phase 6: Post-stow bootstrap

### 6a. Bootstrap the lazy.nvim lockfile

```bash
# Copy the committed snapshot to the runtime path
cp $HOME_DIR/.config/nvim/lazy-lock.json $HOME_DIR/.local/share/nvim/lazy-lock.json
```

Lazy will read this on first launch to pin plugin versions, then write updates to the same
path. The stowed snapshot is never written to at runtime.

### 6b. Create settings.local.json for Claude Code

```bash
# Is the statusline script present on this machine?
ls -la $HOME_DIR/.claude/statusline-command.sh 2>/dev/null || echo "no statusline script"
```

If present, or if this machine needs any other Claude Code overrides, create
`~/.claude/settings.local.json`. Load `scenarios/settings_drift.md` for the full process.

### 6c. Verify the shell loads cleanly

```bash
zsh -i -c "echo shell ok"
```

### 6d. Verify git identity

```bash
git config user.name
git config user.email
```

If empty or wrong, `~/.gitconfig.local` either does not exist or has a stale value. Fix it
before committing anything from this machine.

### 6e. Final stow simulation — confirm nothing is left over

```bash
cd $REPO_DIR && stow --simulate -t $HOME_DIR stow-managed 2>&1
# Should produce no output
```
