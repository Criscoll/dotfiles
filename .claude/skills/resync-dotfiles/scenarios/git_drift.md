# Triage — stash, pull, pop (pull-only machines)

If the machine has uncommitted changes, pull will fail or produce conflicts. The standard process:

```bash
# Check for uncommitted changes
git -C $REPO_DIR status --short
```

Before stashing, cross-reference uncommitted changes against the ledger:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list
```

- Changes already registered as **inline overlays** are expected drift — they will be re-applied via `reapply-overlays` after the pull. No action needed beyond noting them.
- **Unfamiliar** uncommitted changes → prompt the user to classify via the decision menu (`scenarios/read_only_machine.md`) before proceeding with the stash.

```bash
# Stash (after classifying any unfamiliar changes)
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

If any overlay patches are registered, re-apply them now (stash pop may have overwritten symlinked files):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" reapply-overlays
```

Then run the reconcile pass to auto-close any entries whose upstream changes landed in the pull:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" reconcile
```

This machine is pull-only — do not commit or push regardless of outcome.
