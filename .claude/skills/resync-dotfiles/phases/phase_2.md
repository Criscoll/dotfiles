# Phase 2: Timeline Analysis

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md`.

Run the timeline script against the `EXISTS_LOCALLY` files identified in Phase 1:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/timeline.sh $HOME_DIR $REPO_DIR
```

The script reads `/tmp/resync-exists-locally.txt` (written by inventory.sh) and outputs a TSV with four columns:

| Column | Meaning |
|---|---|
| `REL_PATH` | File path relative to HOME_DIR |
| `REPO_DATE` | Date of the last git commit that touched this file |
| `LOCAL_DATE` | Local file's last-modified timestamp |
| `NEWER` | `REPO`, `LOCAL`, `SAME`, or `UNKNOWN` |

Use the `NEWER` column to calibrate how seriously to treat divergence in Phase 3:

| Situation | Interpretation |
|---|---|
| `SAME` | Timestamps within 60s — local was likely the source of the commit; content is probably identical |
| `REPO` | Repo is newer — machine is behind, probably just needs the repo version applied |
| `LOCAL` | Local is newer — possible intentional local change, or local was updated after the last commit |
| `UNKNOWN` | File has no git history or stat failed — inspect manually |

Append the timeline output to `/tmp/resync-audit.md`.

---

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 2 done
```

Then fetch and execute the phase it returns.
