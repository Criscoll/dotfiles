# Phase 1: Core Tools — stow and zsh

stow is required to symlink dotfiles into `~`. zsh is the shell all config is written for — it must be installed before running `chsh` later.

## Check what's already installed
```bash
{ command -v stow && stow --version; } || echo "stow: NOT INSTALLED"
{ command -v zsh && zsh --version; } || echo "zsh: NOT INSTALLED"
```

## Install missing tools

### Linux (apt)
```bash
sudo apt update && sudo apt install -y stow zsh
```

### macOS (brew)
```bash
brew install stow
# zsh ships with macOS — verify with: zsh --version
```

Neither stow nor zsh needs a bleeding-edge version, so the package manager is fine here.

## Confirm
```bash
stow --version && zsh --version
```

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 1 done
```
