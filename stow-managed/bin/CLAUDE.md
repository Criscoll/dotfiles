# CLAUDE.md — `stow-managed/bin/` (wrappers & agent scripts)

Context for editing files in this directory and `agent_scripts/`. Adds to the root
`CLAUDE.md` — it does not replace it.

## Binary & Application Installation

Third-party apps/binaries are installed per-machine; this repo tracks only thin wrappers:

- **`~/opt/`** — the actual binary or app directory. Never tracked here. Each machine installs what it needs.
- **`stow-managed/bin/`** — one wrapper script per binary, tracked. `~/bin/` is a stow-managed symlink to this dir and is in `$PATH` via `.zshrc`.

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
| `rtk` | `~/opt/rtk` |
| `xsv` | `~/opt/xsv` |
| `vd` | `~/opt/visidata/bin/vd` |
| `uv` | `~/opt/uv/uv` |
| `uvx` | `~/opt/uv/uvx` |

**Paths are conventions, not guarantees.** If a wrapper-backed command fails, verify the binary exists before assuming the wrapper is wrong:
```bash
ls ~/opt/nvim-linux-x86_64.appimage    # does the binary exist?
~/bin/nvim --version                    # does the wrapper resolve correctly?
```

If a binary lives elsewhere on a machine, add a direct PATH entry to that machine's `~/.zshrc.local` rather than changing the shared wrapper. **Do not add per-app PATH entries to `.zshrc`** — machine-specific PATH additions belong in `~/.zshrc.local`.

## Audit Scripts (`dotfiles-audit`, `dotfiles-diff`)

These are the canonical read-only setup checkers. Both are default-safe and unchanged — the new flags add a high-level tier without altering existing output.

```
dotfiles-audit --fails            # FAIL/WARN lines + Summary counts only (routing tier)
dotfiles-audit --no-color         # full output, no ANSI (default, unchanged)
dotfiles-audit --update-versions  # refresh versions.lock (primary machine only)

dotfiles-diff --summary           # anomaly lines (WRONG/BLOCKED/FOREIGN/MISSING/BROKEN) + counts (routing tier)
dotfiles-diff --no-color          # full output, no ANSI (default, unchanged)
```

The `--fails` / `--summary` flags are the preferred first step for agent routing decisions — they suppress the 400+ LINKED/LOCAL/PASS lines that are never needed at routing time. Full output is still available on demand via `cat /tmp/resync-*-full.txt` (written by the resync-dotfiles skill).

## Agent-Only Scripts (`agent_scripts/`)

Scripts intended for use **only by an agent** (not by the user directly in a shell) live in `agent_scripts/`. Because `~/bin/` is a directory symlink to `stow-managed/bin/`, this subdir is automatically accessible as `~/bin/agent_scripts/` without re-running stow — no `$PATH` entry needed or wanted.

Skill READMEs reference these by full path (`~/bin/agent_scripts/script-name`) to keep them out of the user's tab-complete while staying callable by an agent. The distinction from user-facing wrappers: these may require agent context, block on user interaction mid-run, or produce agent-formatted output.

## Script Dependency Management

Scripts tracked here may have library dependencies. The rule: **dependencies must be declared in the repo itself**, not assumed globally installed — so a new machine onboards by reading the repo.

### Python scripts — PEP 723 inline metadata (`uv run`)

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["playwright==1.60.0"]
# ///
```

`uv` reads this block, installs into an isolated cache (`~/.cache/uv`), and runs — no venv, no global pip, no manual setup. **Always pin exact versions (`==`)** — loose bounds let a future compromised release slip in silently. When upgrading, update the pin in every script that uses it and test before committing.

Prerequisite: `uv` installed once per machine. The official installer drops `uv`/`uvx` into
`~/.local/bin/`; move both into `~/opt/uv/` so the tracked wrappers (`uv`, `uvx` above) can
find them:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
mkdir -p ~/opt/uv && mv ~/.local/bin/uv ~/.local/bin/uvx ~/opt/uv/
```
All Python scripts under `bin/` and `agent_scripts/` follow this pattern.

**One-time post-install for `webcrawl`:** `crawl4ai` depends on Playwright browsers, which install system-wide outside uv's cache. After a fresh machine setup, run once:
```bash
uvx crawl4ai-setup
```

### Node scripts — `package.json` in the script directory

Declare deps via a `package.json` in the script's directory. Commit both `package.json` (exact versions — no `^`/`~`) and `package-lock.json`. Run `npm ci` (not `install`) on a new machine — it enforces the lockfile exactly. For one-off Node scripts with no natural home, prefer adding a `package.json` alongside or converting to Python.

## Language Standards (linting)

Mechanical enforcement runs via `agent_scripts/lint-file.sh`, called by both the `settings.json` PostToolUse hook and the `lint-on-edit.ts` pi extension. Language detail lives in the `python-knowledge` / `typescript-knowledge` skills (auto-invoked on edit); `lint-file.sh` only maps extensions to fixers:

- `.py` → `uvx ruff check --fix`
- `.ts`/`.tsx`/`.js`/`.jsx`/`.mjs` → `npx eslint --fix`

### Adding a New Language

1. Add one case arm to `agent_scripts/lint-file.sh` with a `command -v <tool>` guard
2. No changes needed to `settings.json`, `lint-on-edit.ts`, or any other config
