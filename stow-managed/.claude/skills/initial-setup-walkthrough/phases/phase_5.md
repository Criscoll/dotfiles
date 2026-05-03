# Phase 5: ripgrep and fzf

**Order matters.** `.zshrc` defines an `fzf_rg_select` function that calls `rg`. If ripgrep isn't installed, fzf shell integration will still work but that function will silently fail. Install ripgrep first.

**Do not install fzf via apt or brew.** Package manager versions are often severely outdated. The git clone method installs the latest release and handles shell integration automatically.

## Step 1: Install ripgrep

### Linux (apt)
```bash
sudo apt install -y ripgrep
```

### macOS (brew)
```bash
brew install ripgrep
```

### Confirm
```bash
rg --version
```

## Step 2: Install fzf from source

```bash
git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf
~/.fzf/install
```

The interactive installer asks three questions — answer **yes** to all three:
1. Add fzf keybindings? → yes
2. Enable fuzzy auto-completion? → yes
3. Update shell config files? → yes

It updates `~/.zshrc` (and/or `~/.bashrc`) with the PATH addition and `source ~/.fzf.zsh` line.

### Confirm
```bash
~/.fzf/bin/fzf --version
```

Version must be **0.48.0 or newer** — that's when `fzf --zsh` shell integration was introduced, which `.zshrc` depends on.

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 5 done
```
