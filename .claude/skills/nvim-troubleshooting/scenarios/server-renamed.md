# Scenario: Invalid server name in ensure_installed or setup_handlers

mason-lspconfig validates server names against its own registry. If a server was renamed in
lspconfig, using the old name produces:

```
WARN Server "tsserver" is not a valid entry in ensure_installed. Make sure to only provide
lspconfig server names.
```

The server will not be installed or configured.

## Known renames

| Old name | New name | When |
|---|---|---|
| `tsserver` | `ts_ls` | nvim-lspconfig ~0.2.x |

## Confirm

```bash
# Check the mason-lspconfig server map for the correct current name
grep -r "tsserver\|ts_ls" ~/.local/share/nvim/lazy/mason-lspconfig.nvim/lua/mason-lspconfig/mappings/ 2>/dev/null | head -5

# Alternatively, search lspconfig's server configs
ls ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/ | grep -i "ts"
```

## Fix

Update every occurrence: `ensure_installed`, `setup_handlers` (if using v1 API), and any
`lspconfig.server.setup()` or `vim.lsp.config('server', ...)` calls.

```lua
-- mason-lspconfig ensure_installed
ensure_installed = {
    "ts_ls",   -- was: "tsserver"
    ...
}

-- vim.lsp.config (new API)
vim.lsp.config('ts_ls', { capabilities = capabilities })

-- lspconfig (old API, if still in use)
lspconfig.ts_ls.setup({ capabilities = capabilities })
```

## Finding the correct name for an unfamiliar server

```bash
# List all servers known to mason-lspconfig
ls ~/.local/share/nvim/lazy/mason-lspconfig.nvim/lua/mason-lspconfig/mappings/

# Or search lspconfig's lsp/ directory
ls ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/ | grep -i "<keyword>"
```
