# Setup Complete

| Phase | What was done |
|-------|---------------|
| 1 | Installed stow and zsh |
| 2 | Initialised git submodules (powerlevel10k, tpm, tmux-resurrect, tmux2k) |
| 3 | Created guard directories; resolved settings.json bootstrap conflict |
| 4 | Ran stow — dotfiles are now symlinked from the repo |
| 5 | Installed ripgrep and fzf (from source, latest version) |
| 6 | Set zsh as default shell; created `.zshrc.local` skeleton |

## What to do next

- **Open a new terminal session** for the default shell change to take effect
- **Edit `~/.zshrc.local`** to add machine-specific aliases, env vars, and PATH entries
- **Tmux plugins**: start tmux and press `prefix + I` to install plugins via tpm
- **Neovim**: run `nvim` once to trigger lazy.nvim's plugin installation
- **p10k**: if this is the first run, Powerlevel10k will launch its configuration wizard on the next zsh start — follow the prompts
