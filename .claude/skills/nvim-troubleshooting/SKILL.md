---
name: nvim-troubleshooting
description: Diagnose and fix Neovim startup errors from plugin API breakages and Mason installation failures — covers mason-lspconfig, nvim-treesitter, nvim-lspconfig, llama.vim deprecations, and Mason server install errors (stale lockfiles, missing system deps)
allowed-tools: Bash Read Grep Edit Write
---

You are diagnosing Neovim startup errors. The most common cause is a Neovim version upgrade or a `:Lazy update` that pulled in a plugin that changed its API. Diagnose first, then load only the scenario files that apply.

## Step 1: Read the log

```bash
cat ~/.local/state/nvim/log | tail -80
# or check the version the user pasted
```

Hold the list of failing plugins and error messages.

## Step 2: Check versions

```bash
# Neovim version
nvim --version | head -1

# Installed plugin commits (compare to what broke)
grep -E '"mason-lspconfig|nvim-treesitter"|nvim-lspconfig' ~/.config/nvim/lazy-lock.json

# Installed versions in the lazy store
ls ~/.local/share/nvim/lazy/ | grep -E "mason-lsp|treesitter|lspconfig"
```

Note: `lazy-lock.json` may live at `~/.local/share/nvim/lazy-lock.json` (runtime path) or
`~/.config/nvim/lazy-lock.json` (repo snapshot). Check the lazy config if uncertain.

## Step 3: Diagnose

Match each error to a row in this table and load the scenario file(s) that apply.

| Error message | Scenario file |
|---|---|
| `attempt to call field 'setup_handlers' (a nil value)` | `scenarios/mason-lspconfig-v2.md` |
| `attempt to call field 'install' (a nil value)` in treesitter | `scenarios/nvim-treesitter-new-api.md` (Case A) |
| `module 'nvim-treesitter.configs' not found` | `scenarios/nvim-treesitter-new-api.md` (Case B) |
| `attempt to call a table value` in treesitter config | `scenarios/nvim-treesitter-new-api.md` (Case B) |
| `WARN The require('lspconfig') "framework" is deprecated` | `scenarios/lspconfig-deprecated.md` |
| `WARN Server "X" is not a valid entry in ensure_installed` | `scenarios/server-renamed.md` |
| `E565: Not allowed to change text or change window` | `scenarios/notify-e565.md` |
| `endpoint is deprecated, use endpoint_fim instead` | `scenarios/llama-vim.md` |
| `[mason-lspconfig.nvim] failed to install X` | `scenarios/mason-install-failures.md` |
| `Lockfile already exists` in mason.log | `scenarios/mason-install-failures.md` (Case A) |
| `spawn: python3 failed with exit code 1` in mason.log | `scenarios/mason-install-failures.md` (Case B) |
| `Could not find executable "npm"` in mason.log | `scenarios/mason-install-failures.md` (Case B) |

```bash
# Load the relevant scenario
cat "${CLAUDE_SKILL_DIR}/scenarios/<name>.md"
```

Handle scenarios in the order listed if multiple apply.

## Invariants — always apply

- Read the actual installed plugin source before assuming an API exists: `ls ~/.local/share/nvim/lazy/<plugin>/lua/`
- Check function exports before calling them: `grep "^M\." ~/.local/share/nvim/lazy/<plugin>/lua/...`
- Never assume an API from a prior Neovim version still exists after upgrading.
- After any config change, test with `nvim --headless -c 'q'` and check the log.
- Prefer the new native API (`vim.lsp.config`, `vim.lsp.enable`) over plugin wrappers where available.
