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
mkdir -p ~/.claude/commands ~/.claude/agents ~/.claude/skills ~/.claude/hooks ~/.pi/agent/extensions ~/.pi/agent/agents
```

With a real directory in place, stow places individual file symlinks inside it. Local-only skills or agents sit alongside them as untracked regular files — the repo never sees them.

Current guard directories:
- `~/.claude/skills/` — global skills (tracked in repo) + machine-specific skills (local only); **preferred mechanism for new additions**
- `~/.claude/agents/` — global agents (tracked in repo) + machine-specific agents (local only)
- `~/.claude/commands/` — legacy; skills can be invoked exactly like commands, so prefer `skills/` for anything new
- `~/.claude/hooks/` — PreToolUse/Notification hook scripts (tracked in repo); no local-only additions expected but must be a real dir so stow links individual files
- `~/.pi/agent/extensions/` — global pi extensions (tracked in repo) + machine-specific extensions (local only)
- `~/.pi/agent/agents/` — global pi subagent definitions (tracked in repo) + machine-specific agents (local only)

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
mkdir -p ~/.pi/agent ~/.pi/agent/extensions ~/.pi/agent/agents
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
- **Agentic harnesses**: Claude Code (primary), pi (`~/opt/pi/`)
- **Container runtime**: Docker (`/usr/bin/docker`) — used by on-demand agent skills (e.g. web-search/SearXNG)

## Docker-Backed Agent Skills

Some agent skills spin up a backing Docker service on demand (host networking, ~10–15s cold start on first pull). The `docker` skill auto-invokes before any `docker run` and covers both the persistent and per-call lifecycle patterns plus the host-networking rationale — follow it rather than duplicating the detail here.

Current Docker-backed skills:

| Skill | Pattern | Image | Container name | Config |
|---|---|---|---|---|
| `web-search` | persistent | `searxng/searxng` | `searxng-websearch` | `~/.config/searxng/settings.yml` |

If Docker is absent on a read-only or minimal machine, exclude the relevant agent script via `.stow-local-ignore`.

## Pi Documentation

Pi's full documentation lives at `~/opt/pi/docs/`. If any task involves pi configuration, settings, skills, extensions, or providers, read the relevant docs from there rather than relying on training data.

If `~/opt/pi/docs/` does not exist on this machine, alert the user before proceeding — pi may not be installed or may be at a different path.

**Target platforms**: Linux (primary) and macOS (read-only pull target). Scripts and shell commands must be portable — avoid GNU-specific flags (`readlink -f`, `realpath` without fallback, `stat -c`, etc.). Use `python3` as a fallback when a portable equivalent is not available.

## Key Conventions

- **Comma-prefix aliases** (`,upload_notes`, `,pdfcompress`, etc.) are used throughout `.zshrc` to namespace custom commands and avoid collisions with system commands
- **Git submodules** are used for external dependencies: `powerlevel10k`, `tpm`, `tmux-resurrect`, `tmux2k`
- **Non-stow directories** (`aider/`, `vscode/`, `darktable/`, `dockerfiles/`, `system/`) are managed manually and not symlinked. `system/` holds config installed into `/etc` via its own install script (see `system/README.md`).

## Design Goals to Keep In Mind

1. **Portability first** — config should work across all devices with minimal friction
2. **Generic vs local split** — don't pollute shared config with device-specific details; use `.local` files
3. **Uni-directional for read-only devices** — some devices are consumers only; design with this constraint in mind (don't rely on bidirectional merges)
4. **Minimal manual steps on pull** — the goal is for `git pull` + `stow` to be sufficient to get up to date on any device

## Documentation and Ideas Repository

Two top-level directories hold institutional knowledge discovered across sessions:

- **`docs/`** — *settled* conventions and best practices reached after research or experience. Treat as authoritative. Before any substantial change, check `docs/` for conventions that constrain implementation; if one turns out wrong, update it rather than working around it. Examples: `skill-authoring-best-practices-2026-06-17.md`, `language-skill-conventions.md`.
- **`ideas/`** — *well-researched* proposals not yet implemented. Each documents context, problem, rationale, findings, and next steps — enough that another agent can resume it. Check `ideas/` before researching an improvement; when deferring a researched improvement, write an idea doc so the context isn't lost. Example: `install-svelte-skills.md`.

The dividing line: settled → `docs/`; still speculative → `ideas/`.

## Subdirectory & Reference Context

Detail has been pushed out of this root file to keep it lean; it loads on demand:

- **`stow-managed/bin/CLAUDE.md`** — binary wrappers, agent-only scripts, script dependency management (PEP 723 / Node), and lint enforcement. Loads when editing files under `bin/`.
- **`stow-managed/.pi/agent/extensions/CLAUDE.md`** — pi extension TUI conventions and hook instrumentation. Loads when editing pi extensions.
- **`docs/hook-analytics-reference.md`** — the unified hook logging/analytics system (JSONL schema, instrumentation steps, `hook-analytics` CLI).
- **`docs/rtk-reference.md`** — full RTK command catalog. RTK rewriting is applied automatically by the hook layer in both harnesses (Claude Code `settings.json` PreToolUse `rtk hook claude`; pi `rtk.ts`), so you rarely need to type `rtk` yourself. **Caveat:** re-running `rtk init` / `rtk init --global` re-expands the full catalog into a CLAUDE.md; if that happens, move it back to `docs/rtk-reference.md` and re-trim.
- **`docs/tailscale-mullvad-routing-2026-06-25.md`** — settled writeup of the Tailscale+Mullvad CGNAT bypass (the two-mark mechanism); implementation lives in `system/`.
