# Dotfiles

Personal terminal configuration managed with [GNU Stow](https://www.gnu.org/software/stow/). Everything in `stow-managed/` gets symlinked into `~`, making this repo the single source of truth for all dotfiles.

---

## Structure

```
dotfiles/
├── stow-managed/        # Symlinked to ~ via GNU Stow
│   ├── .zshrc           # Zsh shell configuration
│   ├── .p10k.zsh        # Powerlevel10k prompt config
│   ├── powerlevel10k/   # Powerlevel10k theme (git submodule)
│   ├── .tmux.conf       # Tmux configuration
│   ├── .tmux/           # Tmux plugins (tpm, tmux-resurrect, tmux2k)
│   ├── .gitconfig       # Git configuration (with delta integration)
│   ├── .mbsyncrc        # mbsync IMAP config
│   ├── .msmtprc         # msmtp SMTP config (symlink)
│   ├── .config/
│   │   ├── nvim/        # Neovim (Lua + lazy.nvim)
│   │   ├── helix/       # Helix editor
│   │   ├── alacritty/   # Alacritty terminal
│   │   ├── msmtp/       # SMTP config
│   │   └── redshift.conf
│   ├── bin/             # Personal binaries (fzf, magick, alacritty)
│   ├── Scripts/         # Automation scripts (sync, backup, cloud)
│   ├── .claude/         # Claude Code global config (CLAUDE.md, design docs, settings.json)
│   └── .local/share/
│       ├── fonts/       # Nerd Fonts and Powerline fonts
│       └── nvim/        # Neovim data files
├── .claude/             # Machine-local Claude Code overrides (settings.local.json — untracked)
├── aider/               # Aider AI pair programmer config
├── vscode/              # VS Code settings (copied manually)
├── darktable/           # DarkTable photo editor config
├── dockerfiles/         # Docker configurations
└── shortcuts/           # Keyboard shortcuts documentation
```

---

## Installation

### Prerequisites

Install GNU Stow:
```bash
sudo apt install stow
```

### Clone and apply

```bash
git clone --recurse-submodules <repo-url> ~/Repos/dotfiles
stow -v -t ~ ~/Repos/dotfiles/stow-managed/
```

The `--recurse-submodules` flag pulls in Powerlevel10k, TPM, tmux-resurrect, and tmux2k.

If you already cloned without submodules:
```bash
git submodule update --init --recursive
```

---

## How to Resync

### Easy case — clean pull, no local conflicts

Pull the latest and re-apply stow:

```bash
cd ~/Repos/dotfiles
git pull --recurse-submodules
stow -v --simulate -t ~ ~/Repos/dotfiles/stow-managed/  # preview first
stow -v -t ~ ~/Repos/dotfiles/stow-managed/             # apply
```

If stow reports no conflicts, you're done.

### Hard case — local files exist that conflict with the repo

Stow will refuse to overwrite a real file with a symlink. When this happens you need to decide, for each conflicting file, whether to:

- **Take the repo version** — back up the local file, delete it, re-run stow
- **Keep the local version** — don't stow that file; leave it as-is
- **Merge** — extract any machine-specific content into a `.local` file (e.g. `.zshrc.local`), then stow the main file
- **Defer** — skip it for now and revisit manually

For a thorough, guided reconciliation — especially on a machine that has drifted significantly — run the Claude Code agent using `resync.md` as the runbook. It will inventory every file, classify conflicts, and produce a plan for your review before touching anything.

---

## Stow Commands

| Command | Description |
|---------|-------------|
| `stow -v -t ~ ~/Repos/dotfiles/stow-managed/` | Apply — create symlinks in `~` |
| `stow -v -t ~ ~/Repos/dotfiles/stow-managed/ --simulate` | Dry run — preview changes without applying |
| `stow -v --adopt -t ~ ~/Repos/dotfiles/stow-managed/` | Adopt — move existing `~` files into repo, then symlink |
| `stow -v --adopt -t ~ ~/Repos/dotfiles/stow-managed/ --simulate` | Dry run for adopt |

> **Note on `--adopt`**: This moves existing files from `~` into the stow package and replaces them with symlinks. Make sure the repo is committed before using this, as it will overwrite files in `stow-managed/`.

---

## Tool Stack

Versions shown are what the config was last tested against on the primary machine. If your installed version is significantly older, things may break — especially Neovim, where the Lua API changes between minor versions.

| Category | Tool | Last tested |
|----------|------|-------------|
| Shell | Zsh + Powerlevel10k | zsh 5.8.1 |
| Terminal | Alacritty | 0.13.0-dev |
| Multiplexer | Tmux (tpm, tmux-resurrect, tmux2k) | next-3.4 |
| Editor (primary) | Neovim (Lua config, lazy.nvim) | v0.11.1 |
| Editor (secondary) | Helix | — |
| Git diff | delta | 0.17.0 |
| Fuzzy finder | fzf + ripgrep | fzf 0.61.1 / rg 13.0.0 |
| Cloud sync | rclone (Google Drive) | v1.62.2 |
| Mail sync | mbsync + msmtp + NeoMutt (WIP) | isync 1.4.4 / msmtp 1.8.16 |

---

## Program Setup Notes

### Rclone

After installing rclone, run `rclone config` to set up your Google Drive remote. The remote name used in the sync scripts must match what you configure here — check `Scripts/` for the expected remote name.

### Alacritty

The `bin/alacritty` entry is a symlink to a locally compiled binary. If your distro ships a compatible version, you can install it via your package manager and remove the `bin/alacritty` symlink before stowing.

### Tmux plugins

After applying stow, start tmux and press `prefix + I` (capital i) to install plugins via TPM.

### Neovim

Plugins are managed by [lazy.nvim](https://github.com/folke/lazy.nvim). On first launch, plugins will be installed automatically. The lockfile is at `stow-managed/.config/nvim/lazy-lock.json`.

### Fonts

Nerd Fonts and Powerline fonts are included under `.local/share/fonts/`. After stowing, run:
```bash
fc-cache -fv
```

### VS Code

VS Code settings are in `vscode/` but are **not** stow-managed. Copy them manually:
```bash
cp vscode/settings.json ~/.config/Code/User/settings.json
```

### Redshift

Config is at `.config/redshift.conf` (stow-managed). Adjust the latitude/longitude values in that file to match your location.

---

## Scripts

Automation scripts live in `stow-managed/Scripts/` (symlinked to `~/Scripts/`):

| Script | Purpose |
|--------|---------|
| `apply_dotfiles.sh` | Apply dotfile changes via rsync |
| `sync_dotfiles.sh` | Sync live configs back into repo via rsync |
| `bisync.sh` | Bidirectional sync of Obsidian notes (rclone) |
| `daily_backup.sh` | Daily backup of Obsidian to Google Drive |
| `download.sh` / `upload.sh` | Pull/push Obsidian notes from/to Google Drive |
| `script_download.sh` / `script_upload.sh` | Pull/push scripts from/to cloud |
| `thunderbird_download.sh` / `thunderbird_upload.sh` | Sync Thunderbird config with Google Drive |
| `encode_mp4.sh` | Transcode MP4 files to MOV via ffmpeg |
