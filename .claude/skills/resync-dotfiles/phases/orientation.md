# Stage: Orientation

Writes `$RESYNC_DIR/state.md`. Reads `HOME_DIR`, `REPO_DIR`, and `RESYNC_DIR` from context (set in SKILL.md Step 0).

## Orient

Read `$REPO_DIR/CLAUDE.md` — internalize the `.local` file pattern, guard directory conventions, what must never be committed, and the uni-directional sync constraint.

Key constraints:
- Generic config → `stow-managed/` (tracked in repo)
- Machine-specific config → `.local` variants (untracked; never committed)
- This session is read-only with respect to the repo: no commits, no staging, no pushes
- Treat this machine as read-only by default — do not assume push access

## Run routing-level audit

```bash
dotfiles-audit --no-color --fails
dotfiles-diff --no-color --summary
git -C "$REPO_DIR" diff --name-only --diff-filter=U 2>/dev/null
```

Check for blockers that should be resolved **before** triage runs:

- Merge conflict markers detected (files in `--diff-filter=U` output) → load `scenarios/merge_conflicts.md` and resolve first
- BLOCKED count > 5 and LINKED count near 0 → cold start; load `scenarios/cold_start.md`
- Other FAILs → check the **Scenario routing** table in SKILL.md; load and work through relevant scenario(s)

If blockers are present, resolve them now. Write `state.md` after blockers are cleared (or if the user decides to proceed and wants triage to handle them instead).

## Initialise ledger and surface backlog

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" init
```

If the ledger already exists, read machine mode and show any pending upstream items:

```bash
MACHINE_MODE="$(bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" mode)"
echo "Machine mode: $MACHINE_MODE"
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list-pending
```

If `MACHINE_MODE=READ-ONLY`: note that no commits or pushes will be made this session; divergences will be recorded in the ledger.

## Confirm paths with user

Brief the user:
- Confirmed HOME_DIR and REPO_DIR
- Any FAILs or anomalies found above

Ask the user to confirm the paths are correct before writing state.md.

## Write state.md

```bash
mkdir -p "$RESYNC_DIR"
{
  echo "# Resync State"
  echo "> Stage: orientation — complete"
  echo ""
  echo "HOME_DIR: $HOME_DIR"
  echo "REPO_DIR: $REPO_DIR"
  echo "Machine: $(hostname)"
  echo "Machine mode: $MACHINE_MODE"
  echo "Started: $(date)"
  echo ""
  echo "## Status: complete"
} > "$RESYNC_DIR/state.md"
cat "$RESYNC_DIR/state.md"
```

## End of stage

Tell the user:

> Orientation complete. Paths confirmed and written to `.resync/state.md`.
> Run `/clear` then re-invoke `/resync-dotfiles` to begin the triage stage.
