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

You are running the dotfiles resync skill. Each invocation covers exactly one stage. At the end of every stage, ask the user to `/clear` and re-invoke — this keeps each stage in a bounded context.

## Step 0: Resolve paths and detect stage

**Resolve HOME_DIR and REPO_DIR:**

```bash
HOME_DIR=$(realpath ~)
for p in ~/Repos/dotfiles ~/dotfiles ~/src/dotfiles ~/projects/dotfiles ~/.dotfiles; do
  [ -d "$p/stow-managed" ] && REPO_DIR=$(realpath "$p") && break
done
echo "HOME_DIR=$HOME_DIR"
echo "REPO_DIR=${REPO_DIR:-NOT FOUND}"
```

If REPO_DIR is not found, ask the user to provide it. Hold `HOME_DIR`, `REPO_DIR`, `RESYNC_DIR="$REPO_DIR/.resync"`, `LEDGER="$REPO_DIR/.resync-ledger.md"`, and `OVERLAYS="$REPO_DIR/.resync-overlays"` for all subsequent commands. The ledger and overlays are durable and survive `.resync/` deletion — never delete them as part of cleanup.

**Check for `$ARGUMENTS` override** — if `$ARGUMENTS` contains a stage name, force that stage:

| `$ARGUMENTS` value | Forced stage |
|---|---|
| `orientation` | orientation |
| `triage` | triage |
| `plan` | plan |
| `execute` | execute |

**Otherwise detect stage from `.resync/` file presence:**

```bash
ls "$RESYNC_DIR/" 2>/dev/null | sort || echo "(no .resync/ dir)"
```

| Condition | Stage |
|---|---|
| `.resync/` missing or `state.md` absent | orientation |
| `state.md` exists, `triage.md` absent | triage |
| `triage.md` exists, `plan.md` absent, `triage.md` contains `Fast-sync eligible: YES` | execute |
| `triage.md` exists, `plan.md` absent | plan |
| `plan.md` exists, does not contain `## Status: APPROVED` | plan (annotation cycle) |
| `plan.md` contains `## Status: APPROVED`, `log.md` absent | execute |
| `log.md` exists | done — read `$RESYNC_DIR/log.md` and report summary to the user |

**Load and follow the phase file for the detected stage:**

```bash
cat "${CLAUDE_SKILL_DIR}/phases/<stage>.md"
```

The phase file is the authoritative instruction for this stage. Follow it exactly.

---

## Scenario routing

When audit output surfaces FAILs or specific anomalies, route to the relevant scenario. Load on demand only — do not read speculatively.

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
| Machine is pull-only / has standing upstream-pending items | `scenarios/read_only_machine.md` |

```bash
cat "${CLAUDE_SKILL_DIR}/scenarios/<name>.md"
```

---

## Invariants — always apply

- Never `stow --adopt` on a read-only machine — it writes local files into the repo.
- Never overwrite a `FOREIGN_SYMLINK` — it is managed by another system.
- Always simulate before applying stow: `stow -v --simulate -t $HOME_DIR stow-managed`.
- Guard dirs must be real directories, not symlinks, before stow runs.
- Machine-specific content belongs in `.local` files — not in tracked config.
- If `bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" $HOME_DIR $REPO_DIR mode` returns `READ-ONLY`: never commit or push; record divergences in the ledger instead.
- The ledger (`.resync-ledger.md`) and `.resync-overlays/` are durable, gitignored, and must never be committed or deleted between runs.
- Use `[ -L "$path" ]` to test for symlinks — not `ls -la "$path/"` (trailing slash follows the link).

---

## Emergency rollback — restore to pre-pull state

```bash
cat "${CLAUDE_SKILL_DIR}/scenarios/rollback.md"
```
