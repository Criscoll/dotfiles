---
name: resync-dotfiles
description: >-
  Sync this machine's dotfiles with the repo — proactive full sync or reactive triage after a pull.
  Auto-invoke BEFORE running stow, after a git pull on the dotfiles repo, or when the user reports
  broken symlinks, merge conflicts, stow collisions, or drift from the repo.
  Trigger phrases: "resync dotfiles", "sync dotfiles", "stow collision", "after git pull",
  "bring machine up to date", "broken symlinks", "dotfiles out of sync", "dotfiles sync problem".
disable-model-invocation: false
allowed-tools: Bash Read Write Glob Grep Edit
---

You are running the dotfiles resync skill. Before entering the phase-by-phase sync workflow, run the canonical audit tools and route to the correct mode.

## Step 1: Orientation

```bash
realpath ~
for p in ~/Repos/dotfiles ~/dotfiles ~/src/dotfiles ~/projects/dotfiles ~/.dotfiles; do
  [ -d "$p/stow-managed" ] && echo "Found: $(realpath $p)"
done
```

Hold `HOME_DIR` and `REPO_DIR` for all subsequent commands. Confirm with the user before proceeding.

After confirming paths, create the working file that persists across context compaction:

```bash
{ echo "# Resync Audit"
  echo "Started: $(date)"
  echo "Machine: $(hostname)"
  echo ""
  echo "## Confirmed Paths"
  echo "HOME_DIR=$HOME_DIR"
  echo "REPO_DIR=$REPO_DIR"
  echo ""
} > /tmp/resync-audit.md
```

Each subsequent phase reads `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of this file.

---

## Step 2: Run the canonical tools

Run the detection tools and append outputs to `/tmp/resync-audit.md`:

```bash
{ echo "## dotfiles-audit"; dotfiles-audit --no-color; echo ""; } >> /tmp/resync-audit.md
```

```bash
{ echo "## dotfiles-diff"; dotfiles-diff --no-color 2>/dev/null | tee /tmp/resync-diff.txt; echo ""; } >> /tmp/resync-audit.md
```

```bash
git -C $REPO_DIR diff --name-only --diff-filter=U 2>/dev/null
```

Present the output to the user. Note any FAIL items from `dotfiles-audit`, BLOCKED/MISSING/WRONG counts from `dotfiles-diff`, and any files with merge conflict markers.

---

## Step 3: Route

Use the following decision table to decide what to do next:

| Condition | Mode |
|---|---|
| Merge conflict markers detected (files listed by the `--diff-filter=U` command) | **Triage** → stash/pull/pop (Step 4), then load `scenarios/merge_conflicts.md` |
| BLOCKED count > 5 and LINKED count near 0 | **Triage** → cold start: load `scenarios/cold_start.md` |
| `dotfiles-audit` has FAIL items → match to symptom table below | **Triage** → load relevant scenario(s) |
| No FAILs, no conflicts, `dotfiles-diff` shows only MISSING (and optionally COLLAPSIBLE), zero BLOCKED/WRONG, no unexpected FOREIGN | **Fast-sync** → inline steps below |
| No FAILs, no conflicts, BLOCKED/WRONG/ambiguous entries present | **Sync** → proceed to `python3 ${CLAUDE_SKILL_DIR}/resync.py --phase 0` |

**Symptom → Scenario routing table:**

| Symptom | Load |
|---|---|
| Machine has no stow symlinks or high BLOCKED count (fresh/unstowed machine) | `scenarios/cold_start.md` |
| Conflict markers in tracked files after `git pull` | `scenarios/merge_conflicts.md` |
| Stow "existing target is neither a link nor empty dir" | `scenarios/stow_collision.md` |
| Guard dir (`.claude/skills`, `.claude/agents`, etc.) is a symlink | `scenarios/guard_directory.md` |
| Symlink at a stow target path pointing outside this repo | `scenarios/foreign_symlink.md` |
| Tracked config file has machine-specific or sensitive content | `scenarios/local_bleed.md` |
| File appears local but its parent directory is a repo symlink | `scenarios/symlinked_via_dir.md` |
| `settings.local.json` missing or stale after a fresh stow | `scenarios/settings_drift.md` |
| `lazy-lock.json` shows as modified or has conflict markers | `scenarios/lazy_lockfile.md` |

### Fast-sync lane

When only MISSING entries are present (safe, non-destructive — stow never clobbers):

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
mkdir -p $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills $HOME_DIR/.claude/hooks
```

If any are symlinks — stop and use the Sync lane instead.

**FS2: Surface `.stow-local-ignore` if present**

```bash
if [ -f "$REPO_DIR/stow-managed/.stow-local-ignore" ]; then
  echo "Active exclusions:"; cat "$REPO_DIR/stow-managed/.stow-local-ignore"
else
  echo "No .stow-local-ignore — all managed files will be linked."
fi
```

**FS3: Simulate and confirm**

```bash
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed
```

Show the `LINK:` lines to the user and ask for confirmation before applying.

**FS4: Apply, verify, and offer COLLAPSIBLE collapse**

```bash
cd $REPO_DIR && stow -v -t $HOME_DIR stow-managed
```

Spot-check a few new symlinks:
```bash
ls -la $HOME_DIR/.zshrc $HOME_DIR/.tmux.conf 2>/dev/null || true
```

If `dotfiles-diff` showed COLLAPSIBLE entries, offer to run `collapsible_dirs.sh` and then `collapse_dir.sh` for each approved directory as an optional follow-up. Do not collapse without explicit user approval.

---

Load scenario files on demand — do not read them speculatively:

```bash
cat "${CLAUDE_SKILL_DIR}/scenarios/<name>.md"
```

Handle scenarios in the order listed if multiple apply (git state before stow state).

---

## Step 4: Triage — stash, pull, pop (pull-only machines)

If the machine has uncommitted changes, pull will fail or produce conflicts. The standard process:

```bash
# Check for uncommitted changes
git -C $REPO_DIR status --short

# If there are changes, stash them
git -C $REPO_DIR stash push -m "pre-pull drift $(date +%Y%m%d-%H%M%S)"

# Pull
git -C $REPO_DIR pull

# Pop the stash
git -C $REPO_DIR stash pop
```

**After the pop:**
- Clean pop → local changes were compatible; re-run Step 2 and re-route.
- Conflicts → load `scenarios/merge_conflicts.md`.
- Pop looks wrong → drop the stash and start from the pulled state: `git -C $REPO_DIR checkout -- .` (only after confirming nothing local is worth keeping).

This machine is pull-only — do not commit or push regardless of outcome.

---

## Invariants — always apply

- Never `stow --adopt` on a read-only machine — it writes local files into the repo.
- Never overwrite a `FOREIGN_SYMLINK` — it is managed by another system.
- Always simulate before applying stow: `stow -v --simulate -t $HOME_DIR stow-managed`.
- Guard dirs must be real directories, not symlinks, before stow runs.
- Machine-specific content belongs in `.local` files — not in tracked config.
- Do not commit from this machine unless push access is confirmed.
- Use `[ -L "$path" ]` to test for symlinks — not `ls -la "$path/"` (trailing slash follows the link).

---

## Sync mode — phase orchestration

When routing to sync mode, start the phase machine:

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --phase 0
```

After each phase, use the routing table to find the next phase, then fetch and execute it:

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route <current_phase> <condition>
python3 ${CLAUDE_SKILL_DIR}/resync.py --phase <next_phase>
```

Each phase file tells you exactly which condition to report when it's done. Follow it.

---

## Emergency rollback — restore to pre-pull state

If the sync went wrong and you want to get back to exactly where things were before pulling:

### Step R1: Find the pre-pull commit

```bash
git -C $REPO_DIR reflog | head -20
```

Look for the entry immediately before `pull` (will read something like `HEAD@{1}: pull: Fast-forward`). Note the SHA — call it `PRE_PULL_SHA`.

### Step R2: Reset the repo

```bash
git -C $REPO_DIR reset --hard $PRE_PULL_SHA
git -C $REPO_DIR log --oneline -5
```

### Step R3: Restore stashed local changes (if Step 4 created a stash)

```bash
git -C $REPO_DIR stash list
git -C $REPO_DIR stash pop stash@{0}
```

If the pop produces conflicts, load `scenarios/merge_conflicts.md`. To discard the stash entirely: `git -C $REPO_DIR stash drop stash@{0}`.

### Step R4: Verify stow is clean

```bash
stow --simulate -v -t $HOME_DIR $REPO_DIR/stow-managed 2>&1
```

### Step R5: Confirm the environment is healthy

```bash
ls -la $HOME_DIR/.zshrc $HOME_DIR/.tmux.conf $HOME_DIR/.config/nvim/init.lua
zsh -i -c "echo shell ok"
```

If anything still looks wrong after the rollback, stop and describe the symptom — do not apply further fixes blindly.
