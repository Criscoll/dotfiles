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
cd ~/Repos/dotfiles && stow -v -t ~ stow-managed
```

This makes the repo the shared base. Files like `~/.zshrc` and `~/.tmux.conf` are symlinks back into this repo.

**Always simulate before applying.** Run stow with `--simulate` first to preview what it will do and catch conflicts before they happen:
```bash
cd ~/Repos/dotfiles && stow -v --simulate -t ~ stow-managed
```

Note: stow must be invoked from the repo root with the bare package name (`stow-managed`). Passing a full path (e.g. `~/Repos/dotfiles/stow-managed/`) causes a "Slashes are not permitted in package names" error.

### This Repo Is Not the Exclusive Owner of Config

Some directories on a machine contain a mix of symlinks — some pointing into this repo, others pointing into machine-specific repos or local directories. This is intentional and expected. For example, `~/.claude/skills/` might hold:
- `resync-dotfiles/` → symlink into this repo (shared)
- `work-deploy/` → symlink into a separate work repo (machine-specific)
- `local-helper/` → a plain local file, no repo at all

The inventory script classifies symlinks that point outside this repo as `FOREIGN_SYMLINK`. These should be treated as intentionally managed by something else — never overwrite them.

### Guard Directories

Some directories need to hold a mix of **tracked files** (symlinked from this repo) and **local-only files** (untracked, machine-specific). For this to work, those directories must exist as real directories on the target machine before stow runs — if they don't exist, stow folds the whole directory into a single symlink, leaving no room for local-only additions.

Pre-create these on any new machine before running stow:
```bash
mkdir -p ~/.claude/commands ~/.claude/agents ~/.claude/skills ~/.claude/hooks
```

With a real directory in place, stow places individual file symlinks inside it. Local-only skills or agents sit alongside them as untracked regular files — the repo never sees them.

Current guard directories:
- `~/.claude/skills/` — global skills (tracked in repo) + machine-specific skills (local only); **preferred mechanism for new additions**
- `~/.claude/agents/` — global agents (tracked in repo) + machine-specific agents (local only)
- `~/.claude/commands/` — legacy; skills can be invoked exactly like commands, so prefer `skills/` for anything new
- `~/.claude/hooks/` — PreToolUse/Notification hook scripts (tracked in repo); no local-only additions expected but must be a real dir so stow links individual files

### Apps That Don't Follow Symlinks

Some apps refuse to read config files that are symlinks (returning EACCES). Known cases:
- **redshift** — `~/.config/redshift.conf` must be a real file. Add it to `.stow-local-ignore` and keep a copy at that path directly.

### Per-Machine Exclusions (`.stow-local-ignore`)

Read-only machines that don't need all tools (e.g. a Mac without mail tools) can drop a `.stow-local-ignore` file in `stow-managed/` to exclude paths from being stowed. Stow reads this file automatically and skips matching entries.

Example `stow-managed/.stow-local-ignore`:
```
^snap/neomutt
^\.mbsyncrc
^\.config/msmtp
```

This file is gitignored — each machine keeps its own version. It is never committed to the repo.

### Bootstrap Conflicts

Some tools create plain files before stow runs. Stow cannot replace a regular file with a symlink and will abort with a conflict error. Back them up before running stow on a new machine:

```bash
mv ~/.claude/settings.json ~/.claude/settings.json.bak   # Claude Code default: {"theme":"dark"}
mv ~/.pi/agent/settings.json ~/.pi/agent/settings.json.bak  # Pi default: {"lastChangelogVersion":"..."}
```

Then stow will create the symlinks pointing to the repo versions.

**Pi guard directories** — `~/.pi/` and `~/.pi/agent/` are created by pi on first run, so they'll usually exist before stow runs. If setting up stow before ever running pi, pre-create them:

```bash
mkdir -p ~/.pi/agent
```

### Machine-Specific Claude Code Settings (`settings.local.json`)

`stow-managed/.claude/settings.json` stows to `~/.claude/settings.json`, which is **user-level scope** — it applies to all Claude Code projects on the machine, not just this repo. Do not confuse it with the project-level `.claude/settings.json` that would live in a project root.

Settings that vary per machine (e.g. the status bar command) belong in `~/.claude/settings.local.json`, which is never committed.

`settings.local.json` overrides `settings.json` at runtime. Common machine-specific overrides:
- `statusLine` — custom status bar (only relevant on machines with the script installed)
- Machine-specific permission rules

Example `~/.claude/settings.local.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "bash $HOME/.claude/statusline-command.sh"
  }
}
```

## Binary & Application Installation

Third-party apps and binaries that are installed per-machine (AppImages, tarballs, compiled binaries) follow a consistent two-part pattern:

- **`~/opt/`** — the actual binary or app directory lives here. Never tracked in this repo. Each machine installs what it needs.
- **`stow-managed/bin/`** — a thin wrapper script per binary, tracked in this repo. `~/bin/` is a stow-managed symlink to this directory and is in `$PATH` via `.zshrc`.

Example wrapper (`stow-managed/bin/nvim`):
```sh
#!/bin/sh
exec "$HOME/opt/nvim-linux-x86_64.appimage" "$@"
```

**Current wrappers and their expected binary paths:**

| Wrapper | Expected binary |
|---|---|
| `nvim` | `~/opt/nvim` |
| `hx` | `~/opt/helix/hx` |
| `go` | `~/opt/go/bin/go` |
| `gofmt` | `~/opt/go/bin/gofmt` |
| `alacritty` | `~/opt/alacritty` |
| `pi` | `~/opt/pi/pi` |

**Important for agents:** The paths above are conventions, not guarantees. If a wrapper-backed command fails on a specific machine, verify the binary actually exists at the expected location before assuming the wrapper is wrong:
```bash
ls ~/opt/nvim-linux-x86_64.appimage    # does the binary exist?
~/bin/nvim --version      # does the wrapper resolve correctly?
```

If the binary is installed somewhere else on a particular machine, update that machine's `~/.zshrc.local` with a direct PATH entry rather than changing the shared wrapper.

**Do not add per-app PATH entries to `.zshrc`.** Machine-specific PATH additions (custom builds, CUDA, LM Studio, etc.) belong in `~/.zshrc.local`.

### Agent-Only Scripts (`stow-managed/bin/agent_scripts/`)

Scripts intended for use **only by an agent** (not by the user directly in a shell) live in `stow-managed/bin/agent_scripts/`. Because `~/bin/` is a directory symlink to `stow-managed/bin/`, this subdirectory is automatically accessible as `~/bin/agent_scripts/` without re-running stow — no `$PATH` entry needed or wanted.

Agent skill READMEs reference these scripts by full path (`~/bin/agent_scripts/script-name`) to keep them out of the user's tab-complete while still being unambiguously callable by an agent.

The distinction from `stow-managed/bin/` (user-facing wrappers): scripts in `agent_scripts/` may require agent context to be useful, block on user interaction mid-run, or produce output formatted for agent consumption rather than human reading.

## Script Dependency Management

Unlike system tools (documented in the wrappers table above), scripts tracked in this repo may have their own library dependencies. The rule: **dependencies must be declared in the repo itself**, not assumed to be globally installed. This lets a new machine onboard by reading the repo rather than tribal knowledge.

### Python scripts — PEP 723 inline metadata (`uv run`)

Python scripts use [PEP 723](https://peps.python.org/pep-0723/) inline dependency blocks and run via `uv`:

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.60.0"]
# ///
```

`uv` reads this block, installs dependencies into an isolated cache (`~/.cache/uv`), and runs the script — no venv, no global pip install, no manual setup step needed on a new machine. First run is slightly slower; subsequent runs use the cache.

**Always pin to an exact version (`==`) — never use `>=`, `~=`, or unpinned ranges.** Loose bounds allow a future compromised release to be pulled in silently on a new machine or after a cache eviction. When intentionally upgrading a dependency, update the pinned version in every script that uses it and test before committing.

**Prerequisite:** `uv` itself must be installed. Install it once per machine:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

All Python scripts under `stow-managed/bin/` and `stow-managed/bin/agent_scripts/` should follow this pattern. Exception: `webcrawl` predates this convention and uses a global `crawl4ai` install — leave it as-is unless revisiting it specifically.

### Node scripts — `package.json` in the script directory

Node scripts that live in a dedicated directory should declare dependencies via a `package.json` in that directory. Commit both `package.json` (with exact versions in the `dependencies` field — no `^` or `~` prefixes) and `package-lock.json`. The agent (or user) runs `npm ci` (not `npm install`) on a new machine — `ci` enforces the lockfile exactly rather than resolving fresh.

For one-off Node scripts without a natural home directory, inline dependencies are not yet standardised in Node — prefer adding a `package.json` alongside the script or converting it to Python.

### What Must Never Be Committed

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
- **Agentic harnesses**: Claude Code (primary), pi (`~/opt/pi/`)

### Pi Documentation

Pi's full documentation lives at `~/opt/pi/docs/`. If any task involves pi configuration, settings, skills, extensions, or providers, read the relevant docs from there rather than relying on training data.

If `~/opt/pi/docs/` does not exist on this machine, alert the user before proceeding — pi may not be installed or may be at a different path.

**Target platforms**: Linux (primary) and macOS (read-only pull target). Scripts and shell commands must be portable — avoid GNU-specific flags (`readlink -f`, `realpath` without fallback, `stat -c`, etc.). Use `python3` as a fallback when a portable equivalent is not available.

## Key Conventions

- **Comma-prefix aliases** (`,upload_notes`, `,pdfcompress`, etc.) are used throughout `.zshrc` to namespace custom commands and avoid collisions with system commands
- **Git submodules** are used for external dependencies: `powerlevel10k`, `tpm`, `tmux-resurrect`, `tmux2k`
- **Non-stow directories** (`aider/`, `vscode/`, `darktable/`, `dockerfiles/`) are managed manually and not symlinked

## Design Goals to Keep In Mind

1. **Portability first** — config should work across all devices with minimal friction
2. **Generic vs local split** — don't pollute shared config with device-specific details; use `.local` files
3. **Uni-directional for read-only devices** — some devices are consumers only; design with this constraint in mind (don't rely on bidirectional merges)
4. **Minimal manual steps on pull** — the goal is for `git pull` + `stow` to be sufficient to get up to date on any device
