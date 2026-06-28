# Phase 0: Orientation

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md`.

## Step 1: Resolve paths

(Already confirmed in SKILL.md Step 1 — read the values from `/tmp/resync-audit.md` if it exists, otherwise re-derive:)

```bash
realpath ~
for p in ~/Repos/dotfiles ~/dotfiles ~/src/dotfiles ~/projects/dotfiles ~/.dotfiles; do
  [ -d "$p/stow-managed" ] && echo "Found: $(realpath $p)"
done
```

Confirm both paths with the user before proceeding.

---

## Step 2: Orient yourself

Read these two files (substituting the confirmed repo path):
- `<REPO_DIR>/README.md` — repo structure, stow conventions, tool stack
- `<REPO_DIR>/CLAUDE.md` — the .local file pattern, guard directories, what must never be committed

Internalize these constraints:
- **Generic config** lives in `stow-managed/` (tracked in repo)
- **Machine-specific config** lives in `.local` variants (untracked, never committed)
- This process is **read-only with respect to the repo**: no git commits, no staging, no pushes
- The target machine may not have push access — treat it as read-only by default

---

## Step 3: Create the working file

Create `/tmp/resync-audit.md` with the confirmed paths at the top:

```
# Resync Audit
Started: [current timestamp]
Machine: [output of `hostname`]

## Confirmed Paths
HOME_DIR=[confirmed home directory]
REPO_DIR=[confirmed repo path]
```

This file persists across context compaction. Append all findings to it as you work through each phase. **Every subsequent phase that runs shell commands must read HOME_DIR and REPO_DIR from this file.**

---

## Step 4: Run dotfiles-audit

```bash
dotfiles-audit --no-color
```

This covers: required binaries, guard directories, broken stow symlinks, git submodule state, Docker, version drift against `versions.lock`, and opt-backed wrapper health.

Append the full output to `/tmp/resync-audit.md` under `## dotfiles-audit`. Present FAIL and WARN lines to the user; note that WARN items don't fail the audit but may need attention.

---

## Step 5: Run dotfiles-diff

```bash
dotfiles-diff --no-color 2>/dev/null | tee /tmp/resync-diff.txt
```

This produces a stow inventory: LINKED (already symlinked), MISSING (not yet on machine), BLOCKED (real file exists where symlink should go), WRONG (symlink points elsewhere), FOREIGN (symlink into a different repo), LOCAL (local-only, not in repo).

Append a count summary to `/tmp/resync-audit.md` under `## dotfiles-diff`. List BLOCKED and MISSING entries individually; others by count. FOREIGN entries should be listed individually for the user to confirm they are expected.

---

## Step 6: Routing check

```bash
git -C $REPO_DIR diff --name-only --diff-filter=U 2>/dev/null
```

Based on the three outputs (audit, diff, conflict check), determine which mode applies using the routing table in SKILL.md. If triage is needed, stop here and follow the triage path. If sync mode, continue.

---

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 0 done
```

Then fetch and execute the phase it returns.
