# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A personal Neovim configuration managed as part of a dotfiles repo (stowed to `~/.config/nvim/`). This directory is a symlink target — the real files live in `~/Repos/dotfiles/stow-managed/.config/nvim/`.

## Testing / Applying Changes

There is no build step or test suite. Changes take effect by reloading Neovim:

```vim
:ReloadConfig          " sources init.lua in the running instance
```

For plugin changes, use `:Lazy sync` inside Neovim. Treesitter parsers: `:TSUpdate`.

The lazy.nvim lockfile at `~/.local/share/nvim/lazy-lock.json` is the live runtime lockfile. The committed `lazy-lock.json` in this directory is a bootstrap snapshot — copy it to the runtime path on a new machine:
```bash
cp ~/.config/nvim/lazy-lock.json ~/.local/share/nvim/lazy-lock.json
```

External formatters invoked via user commands (`FormatLua` → `stylua`, `FormatPython` → `black`) must be installed separately on the host.

## Architecture

**Entry point:** `init.lua` — sets global vim options, leader key (`<Space>`), then delegates to three modules in order: `core`, `lazy-plugin-manager`, `snippets`. Sets colorscheme (`terafox` from nightfox.nvim) last.

**`lua/core/`** — Non-plugin runtime config loaded unconditionally at startup:
- `keybindings.lua` — vim options, custom user commands (`SaveSession`, `ReloadConfig`, `DisableDiagnostics`, etc.), and leader keymaps for markdown workflow (`<leader>c/b/s` for checkbox/blocked/strikethrough toggles)
- `formatters.lua` — `:FormatLua` / `:FormatPython` user commands (shell out to stylua/black)
- `winbar.lua` — breadcrumb path display in the winbar (relative to cwd)

**`lua/lazy-plugin-manager.lua`** — Bootstraps lazy.nvim from `~/.local/share/nvim/lazy/lazy.nvim` and calls `lazy.setup('plugins', …)`, which auto-discovers all files under `lua/plugins/`.

**`lua/plugins/`** — Each file returns a lazy.nvim plugin spec (or list of specs). lazy.nvim discovers these automatically — no central registration needed. Adding a new file here is sufficient to add a plugin.

**`lua/snippets/`** — LuaSnip snippet definitions. `init.lua` loads `nvim-luasnip.lua`, which defines snippets for `all` (date), `markdown` (`,task` frontmatter), and `html` (boilerplate).

**`ftplugin/java.lua`** — Loaded automatically by Neovim for Java buffers. Starts nvim-jdtls using the Mason-installed jdtls path; workspace data goes to `/home/.cache/jdtls/`.

## LSP Setup

LSP uses the modern `vim.lsp.config()` / `vim.lsp.enable()` API (not `lspconfig.setup()`). The chain is:
1. **mason.nvim** — installs servers
2. **mason-lspconfig.nvim** — `ensure_installed`: `lua_ls`, `pylsp`, `clangd`, `ts_ls`, `html`
3. **nvim-lspconfig** — calls `vim.lsp.config()` for each server; `automatic_enable = true` (default) means mason-lspconfig auto-enables installed servers via `vim.lsp.enable()`
4. **svelte** — manually enabled via `vim.lsp.enable('svelte')` since it's not Mason-managed
5. **jdtls** (Java) — configured separately in `ftplugin/java.lua`

Python LSP: ruff + black enabled, pyflakes/pylint/pycodestyle/yapf disabled.

## Key Plugin Keymaps Summary

| Prefix | Plugin | Purpose |
|--------|--------|---------|
| `<leader>1/2` | nvim-tree | Toggle / reveal in file tree |
| `<leader>f*` | Telescope | File/grep/buffer/LSP/git pickers |
| `<leader>d*` | nvim-lspconfig | LSP actions (definition, diagnostics, hover, etc.) |
| `<leader>g*` | Telescope + fugitive | Git (blame, commits, status) |
| `<leader>o` | outline.nvim | Symbol outline toggle |
| `<leader>sp` | core | Toggle spell check |
| `<leader>c/b/s` | core | Markdown checkbox / blocked / strikethrough |
| `<C-w>z` | core | Expand window to new tab |
| `]n / [n / <C-n> / <C-m>` | treesitter | Jump between functions |

**Telescope `<leader>fsu` / `<leader>fsw`:** live-grep-args with `<C-g>` inside the picker to walk up to parent directories — useful for searching parent repos.

## Colorscheme

Active: `terafox` (from nightfox.nvim). Other installed themes: kanagawa, catppuccin, everforest, evergarden, melange, nordic, onenord. Switch with `:colorscheme <name>`.

## Completion Stack

nvim-cmp with sources (in priority order): LSP → LuaSnip → buffer → ripgrep (keyword ≥ 3 chars) → path. `<Tab>`/`<S-Tab>` cycle completions and also jump LuaSnip nodes. `<CR>` only confirms an explicitly selected item (does not auto-select first).

## Debugging Neovim Internals

### Reading AppImage runtime files

The nvim binary is an AppImage. Error paths like `...im-lCMkIja/usr/share/nvim/runtime/...` are ephemeral squashfs mount points that disappear after Neovim exits — you cannot `ls` them after the fact.

To read a specific runtime file at a known path, extract it while headless:

```bash
nvim --headless -c '
  lua vim.fn.writefile(
    vim.fn.readfile(vim.fn.expand("$VIMRUNTIME") .. "/lua/vim/treesitter/languagetree.lua"),
    "/tmp/nvim_lt.lua"
  )
' -c 'q'
```

Substitute the path after `$VIMRUNTIME` for any runtime module. Use this when an error message contains a line number inside a Neovim built-in file.

### Coroutine-truncated stack traces

Treesitter parsing is async (`coroutine.wrap`). When the traceback ends at `[C]: in function 'f'` with no further Lua frames, the real error is inside the coroutine — inner frames are invisible. Extract the relevant runtime files and read the actual source at the line numbers mentioned in the error message to find the true call site.

### Ground-truth principle

Neovim's own built-in implementations of a function are the authoritative reference for what the current API expects. When a plugin's handler is crashing, read the equivalent built-in handler in `$VIMRUNTIME` to see the correct call signature — do not rely on plugin docs or prior knowledge of the API.
