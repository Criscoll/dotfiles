# Phase 2: Timeline Analysis

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md` and substitute them in all commands below.

For each file classified as `EXISTS_LOCALLY` in Phase 1:

1. Get when the **repo version** was last changed:
   ```bash
   git -C $REPO_DIR log --follow -1 --format="%ai %s" -- stow-managed/<path>
   ```

2. Get when the **local version** was last modified:
   ```bash
   stat -c "%y" $HOME_DIR/<file>
   ```

3. Note which side is newer and by how much.

Use this to calibrate how seriously to treat divergence:

| Situation | Interpretation |
|---|---|
| Local recent, repo untouched for a long time | Likely intentional local customisation — treat carefully |
| Repo updated recently, local stale | Probably just needs repo version applied |
| Both changed recently | Genuine conflict — needs careful review in Phase 3 |

Append timeline findings to `/tmp/resync-audit.md`.

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 2 done
```

Then fetch and execute the phase it returns.
