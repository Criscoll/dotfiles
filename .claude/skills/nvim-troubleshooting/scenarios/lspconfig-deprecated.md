# Scenario: require('lspconfig') deprecation warning

On nvim 0.11+, `require('lspconfig')` prints a deprecation warning on every startup:

```
WARN The `require('lspconfig')` "framework" is deprecated, use vim.lsp.config
(see :help lspconfig-nvim-0.11) instead.
Feature will be removed in nvim-lspconfig v3.0.0
```

This is a warning, not a crash. But it will become a hard error in nvim-lspconfig v3.

## What changed

nvim-lspconfig v2.x added a `lsp/` directory (one file per server) that neovim auto-loads
from runtimepath. These files register the default server config (cmd, filetypes, root_markers)
directly into neovim's native `vim.lsp.config` system. The `require('lspconfig')` module
is now just a compatibility shim that warns and delegates.

## Confirm

```bash
# lspconfig now ships lsp/ files, not just lua/lspconfig/
ls ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/ | wc -l
# Should show 300+ files

# Check if any config still requires lspconfig directly
grep -rn "require.*lspconfig" ~/.config/nvim/lua/plugins/
```

## Fix

Replace all `require('lspconfig').server.setup({...})` calls with the native API.
Keep `neovim/nvim-lspconfig` as a lazy plugin — its `lsp/` directory is needed for default
server configs (cmd, filetypes, root_markers). Just stop calling `require('lspconfig')`.

### Before (deprecated)

```lua
local lspconfig = require('lspconfig')
lspconfig.lua_ls.setup({
    capabilities = capabilities,
    settings = { Lua = { diagnostics = { globals = { "vim" } } } },
})
lspconfig.ts_ls.setup({ capabilities = capabilities })
```

### After (native API)

```lua
-- vim.lsp.config merges with the lsp/<server>.lua defaults loaded from runtimepath
vim.lsp.config('lua_ls', {
    capabilities = capabilities,
    settings = { Lua = { diagnostics = { globals = { "vim" } } } },
})
vim.lsp.config('ts_ls', { capabilities = capabilities })

-- For servers not managed by mason, also enable them explicitly:
vim.lsp.enable('svelte')
```

With mason-lspconfig `automatic_enable = true` (the default), mason calls
`vim.lsp.enable(server)` for each installed server after our `vim.lsp.config()` calls
have already run synchronously. No explicit `vim.lsp.enable()` needed for mason-managed
servers.

## Key differences in the new API

| lspconfig | vim.lsp.config |
|---|---|
| `root_dir = function(fname) ... end` | `root_markers = { "file1", ".git" }` |
| `lspconfig.util.root_pattern(...)` | Not needed — use `root_markers` |
| `lspconfig.server.setup({})` | `vim.lsp.config('server', {}); vim.lsp.enable('server')` |
| `on_attach` in setup | `on_attach` in `vim.lsp.config` (same field) |
| `capabilities` in setup | `capabilities` in `vim.lsp.config` (same field) |

## Checking a server's default config

```bash
# See what the default config provides before deciding what to override
cat ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/clangd.lua
cat ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/lua_ls.lua
```

Avoid overriding fields that already have good defaults (e.g. clangd's root_markers already
include compile_commands.json and .git).
