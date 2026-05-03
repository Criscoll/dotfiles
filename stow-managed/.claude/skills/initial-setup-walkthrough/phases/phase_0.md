# Phase 0: Orientation

Establish the environment before making any changes.

## Steps

**1. Detect OS and architecture:**
```bash
uname -s && uname -m
```

**2. Resolve home directory and find the repo:**
```bash
realpath ~
for d in ~/Repos/dotfiles ~/dotfiles ~/projects/dotfiles ~/code/dotfiles; do
  [ -d "$d/stow-managed" ] && echo "REPO_FOUND=$d" && break
done
```

If the repo isn't found at any of those paths, ask the user where it lives.

**3. Write confirmed values to the state file** (substitute actual values for the placeholders):
```bash
cat > /tmp/initial-setup-walkthrough-state.txt << EOF
HOME_DIR=$(realpath ~)
REPO_DIR=FILL_IN_ACTUAL_PATH
OS=FILL_IN_linux_or_macos
EOF
```

**4. Present a summary of what this walkthrough will do, in order:**
- **Phase 1** — Install stow and zsh via package manager
- **Phase 2** — Initialise git submodules (powerlevel10k, tpm, tmux-resurrect, tmux2k)
- **Phase 3** — Create guard directories; resolve the `settings.json` bootstrap conflict
- **Phase 4** — Run stow (simulate then apply)
- **Phase 5** — Install ripgrep, then fzf from source (package manager version is outdated)
- **Phase 6** — Set zsh as the default shell; create a `.zshrc.local` skeleton

Confirm with the user before proceeding.

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 0 ready
```
