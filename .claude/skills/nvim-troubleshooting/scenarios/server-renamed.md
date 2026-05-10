# Scenario: Invalid server name in ensure_installed

mason-lspconfig validates `ensure_installed` entries against its own registry, which may
differ from nvim-lspconfig's server names. Either direction can produce this warning:

```
WARN Server "X" is not a valid entry in ensure_installed. Make sure to only provide
lspconfig server names.
```

**Key distinction:** `ensure_installed` uses **mason-lspconfig names**. `vim.lsp.config()`
and `lspconfig.X.setup()` use **nvim-lspconfig names**. These are sometimes different for
the same server — always confirm each separately.

## Known name divergence

| mason-lspconfig name | nvim-lspconfig name | Notes |
|---|---|---|
| `tsserver` | `ts_ls` | TypeScript — nvim-lspconfig renamed it ~0.2.x; mason-lspconfig kept `tsserver` |

## Confirm

```bash
# What name does mason-lspconfig use?
rg "tsserver|ts_ls" ~/.local/share/nvim/lazy/mason-lspconfig.nvim/lua/mason-lspconfig/mappings/

# What name does nvim-lspconfig use?
ls ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/ | grep -i "ts"
```

## Fix

Use the **mason-lspconfig name** in `ensure_installed`, and the **nvim-lspconfig name** in
`vim.lsp.config()` — they may differ:

```lua
-- mason-lspconfig: use its registry name
ensure_installed = {
    "tsserver",   -- mason-lspconfig name (even though nvim-lspconfig calls it ts_ls)
    ...
}

-- vim.lsp.config: use the nvim-lspconfig name
vim.lsp.config('ts_ls', { capabilities = capabilities })
```

Do NOT blindly update `vim.lsp.config()` to match `ensure_installed` or vice versa —
they key off different registries.

## Finding the correct name for an unfamiliar server

```bash
# mason-lspconfig registry
ls ~/.local/share/nvim/lazy/mason-lspconfig.nvim/lua/mason-lspconfig/mappings/
rg "<keyword>" ~/.local/share/nvim/lazy/mason-lspconfig.nvim/lua/mason-lspconfig/mappings/

# nvim-lspconfig server list
ls ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/ | grep -i "<keyword>"
```
