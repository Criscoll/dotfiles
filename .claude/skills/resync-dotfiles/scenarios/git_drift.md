# Triage — stash, pull, pop (pull-only machines)

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
