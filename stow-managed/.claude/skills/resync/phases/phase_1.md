# Phase 1: Inventory

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md` and substitute them in all commands below.

## Check guard directories first

The following must exist as **real directories** (not symlinks) before stow can place individual file symlinks inside them:
- `~/.claude/commands/`
- `~/.claude/agents/`
- `~/.claude/skills/`

```bash
ls -la $HOME_DIR/.claude/commands $HOME_DIR/.claude/agents $HOME_DIR/.claude/skills
```

- If missing → note as prerequisite for Phase 7
- If a symlink → flag it; stow previously folded it and local-only files cannot coexist safely

## Walk the repo

Walk all files under `$REPO_DIR/stow-managed/`, skipping:
- Git submodule directories: `powerlevel10k/`, `.tmux/plugins/`
- Non-stow directories at the repo root: `aider/`, `vscode/`, `darktable/`, `dockerfiles/`

For each file, determine its target path in `HOME_DIR` (strip the `stow-managed/` prefix) and classify it:

| Classification | Meaning |
|---|---|
| `SYMLINKED` | `~/file` is a symlink pointing into this repo — already in sync |
| `EXISTS_LOCALLY` | `~/file` is a real file — needs comparison in later phases |
| `MISSING_LOCALLY` | `~/file` does not exist — repo has something this machine doesn't yet |

Write the full inventory to `/tmp/resync-audit.md`.

## Fast path

If **every** file is `MISSING_LOCALLY` (clean-slate machine with nothing existing locally), skip phases 2–4 and go directly to classification.

## Next

```bash
# All files are MISSING_LOCALLY — clean slate:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 1 clean_slate

# Any file EXISTS_LOCALLY — needs analysis:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 1 has_local_files
```

Then fetch and execute the phase it returns.
