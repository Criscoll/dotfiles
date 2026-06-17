# RTK (Rust Token Killer) — CLI Proxy to Reduce Token Usage

## What It Is

[rtk-ai/rtk](https://github.com/rtk-ai/rtk) — open source CLI proxy that sits between the agent and the shell, compressing command outputs before they reach the LLM context window. Single Rust binary, zero dependencies, Apache 2.0.

Supports: Claude Code, Pi, Cursor, Windsurf, Gemini CLI, OpenAI Codex, Aider, Cline, Copilot.

## How It Works

Four strategies applied per command type:
1. **Smart filtering** — strips comments, whitespace, and boilerplate
2. **Grouping** — aggregates similar items (files by directory, errors by type)
3. **Truncation** — keeps signal, drops redundancy
4. **Deduplication** — collapses repeated log lines with counts

It integrates via a **PreToolUse hook** (Claude Code) or a **tool_call extension** (Pi) that transparently rewrites commands before execution — e.g. `git status` becomes `rtk git status`. The agent never knows the difference.

## Claimed Savings

From the README, a 30-min Claude Code session:

| Command | Standard | With RTK | Savings |
|---|---|---|---|
| `git status` | 3,000 | 600 | -80% |
| `git log` | 2,500 | 500 | -80% |
| `git diff` | 10,000 | 2,500 | -75% |
| `cat` / `read` | 40,000 | 12,000 | -70% |
| `grep` / `rg` | 16,000 | 3,200 | -80% |
| `cargo test` / `npm test` | 25,000 | 2,500 | -90% |
| `pytest` | 8,000 | 800 | -90% |
| `ls` / `tree` | 2,000 | 400 | -80% |
| **Total** | **~118,000** | **~23,900** | **-80%** |

## Compatibility with Current Setup

### Hooks

Current PreToolUse hooks in `~/.claude/settings.json`:
1. `catch-dangerous-commands.sh` — blocks destructive commands
2. `catch-stupid-commands.sh` — blocks inefficient patterns (grep -r → rg)

RTK adds a **third** PreToolUse entry. Call order: (1) dangerous check → (2) stupid check → (3) rtk rewrite. No conflict — safety hooks deny commands RTK can't rewrite, and RTK rewrites commands safety hooks don't flag.

Known minor friction: `catch-stupid-commands.sh` blocks `grep -r` before RTK gets to rewrite it to `rtk grep`. Git and test rewrites are unaffected.

### Pi Extensions

Current extensions in `~/.pi/agent/extensions/`: answer, ask-user, context-ui, dangerous-commands, inefficient-commands, inline-plan, notify-ready, prompt-history, todos, web-search.

RTK drops `rtk.ts` alongside them. It hooks `tool_call` for bash commands, fails open if `rtk` binary is absent. Compatible with existing extensions.

### Stow

RTK writes files into `~/.claude/hooks/` and `~/.pi/agent/extensions/` — these are real directories (guard dirs), not stow symlinks. Files sit alongside stow-managed symlinks. No conflict.

## Installation Steps

```bash
# 1. Install the binary (to ~/.local/bin)
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh

# 2. Verify
rtk --version

# 3. Install Claude Code hook (global)
rtk init -g

# 4. Install Pi extension
rtk init --agent pi

# 5. Restart agents
```

## Uninstall

Clean — removes only RTK artifacts, preserves third-party hooks:

```bash
rtk uninstall          # Remove Claude Code hook + RTK.md
rtk uninstall --pi     # Remove pi extension
rm ~/.local/bin/rtk    # Remove binary
```

## Binaries Convention Note

Current dotfiles convention: binaries in `~/opt/`, wrappers in `~/bin/`. RTK's installer puts the binary in `~/.local/bin/`. Options:
- Add `~/.local/bin` to PATH in `~/.zshrc.local`
- Move binary to `~/opt/rtk` and add a `~/bin/rtk` wrapper
- Leave as-is and accept the extra PATH entry

RTK would work the same either way — the hooks call `rtk rewrite` by binary name and rely on PATH resolution.

## Broader Ecosystem

Related projects from the [awesome-llm-token-optimization](https://github.com/pleasedodisturb/awesome-llm-token-optimization) list:

| Strategy | Tools |
|---|---|
| **Prompt caching** | Anthropic (90%), OpenAI (50%), Gemini (90%) |
| **Model routing** | RouteLLM, LiteLLM, NotDiamond |
| **Prompt compression** | LLMLingua (up to 20x), Headroom |
| **Token-efficient tool use** | Anthropic built-in flag (70% output reduction) |
| **Batch APIs** | 50% from all providers |
| **Response caching** | Redis cache layer — 100% on repeats |