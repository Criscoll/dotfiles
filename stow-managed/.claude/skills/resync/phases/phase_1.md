# Phase 1: Inventory

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md`.

## Check guard directories

The following must exist as **real directories** (not symlinks) before stow can place individual file symlinks inside them. Check each one explicitly:

```bash
for d in commands agents skills; do
  path="$HOME_DIR/.claude/$d"
  if [ -L "$path" ]; then
    echo "SYMLINK: $path -> $(readlink "$path")  *** FLAG: cannot safely host local-only files ***"
  elif [ -d "$path" ]; then
    echo "OK: $path"
  else
    echo "MISSING: $path"
  fi
done
```

- `OK` → no action needed
- `MISSING` → note as prerequisite for Phase 7 (create with `mkdir -p` before stowing)
- `SYMLINK` → flag for the user; stow previously folded the directory and local-only files cannot safely coexist inside it

> **Note:** use `[ -L "$path" ]` — not `ls -la "$path/"`. A trailing slash follows symlinks, making a symlinked directory look like a real one.

---

## Walk the repo

Run the inventory script:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/inventory.sh $HOME_DIR $REPO_DIR
```

The script outputs two sections.

**File inventory** — a TSV with columns `CLASSIFICATION` and `REL_PATH`:

| Classification | Meaning |
|---|---|
| `SYMLINKED` | Target is a symlink pointing into the repo — already in sync |
| `SYMLINKED_VIA_DIR` | A parent directory is a symlink into the repo; the leaf file appears real but is already in sync — **do not treat as local** |
| `EXISTS_LOCALLY` | Target is a genuinely local real file — needs comparison in later phases |
| `MISSING_LOCALLY` | Target does not exist on this machine |
| `STOW_EXCLUDED` | Stow's built-in default exclusion list will prevent it from ever linking this file (e.g. `.gitignore`, `.gitmodules`). It will always appear absent locally — this is expected, not a gap |

**Directory structure check** — appears after the file inventory under `## Directory Structure`:

| Classification | Meaning |
|---|---|
| `COLLAPSIBLE_DIR` | A real directory that contains only repo-managed symlinks; stow could replace it with a single directory symlink. Only the shallowest directory in each collapsible subtree is reported. |
| `REAL_DIR_WITH_LOCAL` | A real directory containing local-only files; cannot be collapsed without first moving those files. |

The script also writes:
- `/tmp/resync-exists-locally.txt` — `EXISTS_LOCALLY` paths, consumed by phases 2 and 3
- `/tmp/resync-missing-locally.txt` — `MISSING_LOCALLY` paths
- `/tmp/resync-collapsible-dirs.txt` — `COLLAPSIBLE_DIR` paths, consumed by phase 7

Write a summary of counts per classification to `/tmp/resync-audit.md`. List `EXISTS_LOCALLY`, `MISSING_LOCALLY`, and `COLLAPSIBLE_DIR` entries individually; the others can be summarised by count.

---

## Fast path

If there are zero `EXISTS_LOCALLY` files (no genuinely local files to analyse), skip phases 2–4 and go directly to classification.

---

## Next

```bash
# No EXISTS_LOCALLY files — skip to classification:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 1 clean_slate

# Any EXISTS_LOCALLY files — need analysis:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 1 has_local_files
```

Then fetch and execute the phase it returns.
