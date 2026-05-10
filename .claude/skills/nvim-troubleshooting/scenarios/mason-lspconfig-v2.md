# Scenario: setup_handlers is nil (mason-lspconfig v2)

mason-lspconfig v2 removed `setup_handlers`. The function simply does not exist. Any config
that calls `mason_lspconfig.setup_handlers({...})` will crash with `attempt to call field
'setup_handlers' (a nil value)`.

## What changed

| v1 | v2 |
|---|---|
| `mason_lspconfig.setup_handlers({ fn, ["server"] = fn })` | Gone — no equivalent |
| `automatic_enable` did not exist | `automatic_enable = true` (default) calls `vim.lsp.enable()` for each installed server |

v2 also changed the default behaviour: installed servers are now **automatically enabled** via
`vim.lsp.enable()` (neovim 0.11+ native LSP, not lspconfig). If you set up servers with
`lspconfig.server.setup()` alongside this, they will conflict.

## Confirm

```bash
grep -n "setup_handlers" ~/.config/nvim/lua/plugins/lsp-config.lua
grep -n "automatic_enable" ~/.local/share/nvim/lazy/mason-lspconfig.nvim/lua/mason-lspconfig/settings.lua
```

No `setup_handlers` in the settings file confirms this is v2.

## Fix

### Option A — migrate to vim.lsp.config (preferred on nvim 0.11+)

This is the native neovim LSP API. nvim-lspconfig ships `lsp/<server>.lua` default configs
that are auto-loaded from runtimepath, so keeping `neovim/nvim-lspconfig` as a lazy plugin
is still necessary (for the defaults), but `require('lspconfig')` is no longer called.

In the mason-lspconfig spec, keep `automatic_enable` at its default (`true`):

```lua
mason_lspconfig.setup({
    ensure_installed = { "lua_ls", "pylsp", "clangd", "ts_ls", "html" },
    -- automatic_enable = true (default): calls vim.lsp.enable() for each installed server
})
```

In the nvim-lspconfig spec config function, replace all `lspconfig.server.setup({...})` calls:

```lua
local capabilities = require('cmp_nvim_lsp').default_capabilities()

-- vim.lsp.config merges with the lsp/<server>.lua defaults from nvim-lspconfig
vim.lsp.config('lua_ls', {
    capabilities = capabilities,
    settings = { Lua = { diagnostics = { globals = { "vim" } } } },
})
vim.lsp.config('pylsp',  { capabilities = capabilities, settings = { ... } })
vim.lsp.config('clangd', { capabilities = capabilities, filetypes = { "c", "cpp", "h", "hpp" } })
vim.lsp.config('ts_ls',  { capabilities = capabilities })
vim.lsp.config('html',   { capabilities = capabilities })

-- Servers not managed by mason need explicit enable
vim.lsp.config('svelte', { capabilities = capabilities })
vim.lsp.enable('svelte')
```

mason-lspconfig's `automatic_enable` handles `vim.lsp.enable()` for mason-installed servers
asynchronously after the registry refresh. Our `vim.lsp.config()` calls are synchronous, so
they always run first.

### Option B — keep lspconfig, disable automatic_enable

If you must stay on the lspconfig framework (e.g. for plugins that depend on it):

```lua
mason_lspconfig.setup({
    ensure_installed = { ... },
    automatic_enable = false,  -- prevent vim.lsp.enable() from conflicting with lspconfig
})

-- Then set up each server directly in the nvim-lspconfig config function:
lspconfig.lua_ls.setup({ capabilities = capabilities, settings = { ... } })
lspconfig.ts_ls.setup({ capabilities = capabilities })
-- etc.
```

This avoids the conflict but keeps the `require('lspconfig')` deprecation warning on nvim 0.11+.
See `scenarios/lspconfig-deprecated.md` for context on that warning.
