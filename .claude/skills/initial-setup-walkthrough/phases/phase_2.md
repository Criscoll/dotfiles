# Phase 2: Git Submodules

The repo uses submodules for: powerlevel10k (prompt theme), tpm (tmux plugin manager), tmux-resurrect, and tmux2k. Without initialising them, zsh will fail to source the p10k theme on startup.

## Read state and check status
```bash
. /tmp/initial-setup-walkthrough-state.txt && cd "$REPO_DIR" && git submodule status
```

Any line starting with `-` means that submodule is uninitialised.

## Initialise (if any are missing)
```bash
. /tmp/initial-setup-walkthrough-state.txt && cd "$REPO_DIR" && git submodule update --init --recursive
```

## Confirm
```bash
. /tmp/initial-setup-walkthrough-state.txt && cd "$REPO_DIR" && git submodule status
```

All lines should now start with a space or `+` — none should start with `-`.

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 2 done
```
