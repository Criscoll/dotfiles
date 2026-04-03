# CLAUDE.md — Dotfiles Repo Context

## Purpose

This repo manages terminal-focused configuration (dotfiles) shared across multiple machines:
- **Primary devices** — can both push and pull; changes originate here
- **Read-only devices** — can only pull from this repo; they consume config but never contribute back

The flow for read-only devices is strictly **uni-directional**: changes go from a primary device → repo → read-only device.

## The .local Config Pattern

Because some config is machine-specific (e.g. work-only aliases, work-specific env vars), the repo uses a `.local` file convention:

- Generic, shareable config lives in the standard files (`.zshrc`, `.gitconfig`, etc.) and is tracked in this repo
- Machine-specific config lives in `.local` variants (e.g. `.zshrc.local`) which are sourced by the main config file but are **not** tracked in this repo — they exist only on the individual machine

When adding config, ask: "Is this generic enough to share across all devices?" If yes → standard file. If device-specific → `.local` file.

## How It Works (GNU Stow)

Everything under `stow-managed/` is symlinked into `~` via:
```bash
stow -v -t ~ ~/Repos/dotfiles/stow-managed/
```

This makes the repo the single source of truth. Files like `~/.zshrc` and `~/.tmux.conf` are symlinks back into this repo.

**Always simulate before applying.** Run stow with `--simulate` first to preview what it will do and catch conflicts before they happen:
```bash
stow -v --simulate -t ~ ~/Repos/dotfiles/stow-managed/
```

## What Must Never Be Committed

This repo is version-controlled and potentially synced across machines — **never commit sensitive or runtime-specific data.** Before staging any changes, verify that no file contains:

- **Credentials or secrets** — API keys, tokens, passwords, `.credentials.json`
- **Shell history** — `.zsh_history`, `.bash_history`
- **Runtime state** — session data, plans, todos, cache, debug output
- **Machine-specific private data** — anything that should stay in a `.local` file

If in doubt, use a `.local` file (untracked) rather than the shared config. The `.gitignore` should be kept up to date to prevent accidental commits of these file types.

## Tool Stack

- **Shell**: Zsh + Powerlevel10k
- **Terminal**: Alacritty
- **Multiplexer**: Tmux (tpm, tmux-resurrect, tmux2k)
- **Editor (primary)**: Neovim (Lua config, lazy.nvim)
- **Editor (secondary)**: Helix
- **Git diff**: delta
- **Fuzzy finder**: fzf + ripgrep
- **Cloud sync**: rclone (Google Drive)
- **Mail**: mbsync + msmtp + NeoMutt (WIP)

## Key Conventions

- **Comma-prefix aliases** (`,upload_notes`, `,pdfcompress`, etc.) are used throughout `.zshrc` to namespace custom commands and avoid collisions with system commands
- **Git submodules** are used for external dependencies: `powerlevel10k`, `tpm`, `tmux-resurrect`, `tmux2k`
- **Non-stow directories** (`aider/`, `vscode/`, `darktable/`, `dockerfiles/`) are managed manually and not symlinked

## Design Goals to Keep In Mind

1. **Portability first** — config should work across all devices with minimal friction
2. **Generic vs local split** — don't pollute shared config with device-specific details; use `.local` files
3. **Uni-directional for read-only devices** — some devices are consumers only; design with this constraint in mind (don't rely on bidirectional merges)
4. **Minimal manual steps on pull** — the goal is for `git pull` + `stow` to be sufficient to get up to date on any device
