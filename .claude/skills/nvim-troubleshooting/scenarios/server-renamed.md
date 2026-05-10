# Scenario: Invalid server name in ensure_installed

mason-lspconfig validates `ensure_installed` entries against its own registry, which may
differ from nvim-lspconfig's server names. Either direction can produce this warning:

```
WARN Server "X" is not a valid entry in ensure_installed. Make sure to only provide
lspconfig server names.
```

**Key distinction:** `ensure_installed` and `vim.lsp.config()` both use **lspconfig server
names** — they must match. The warning fires when a name in `ensure_installed` has no
corresponding entry in the mason registry's `pkg_spec.neovim.lspconfig` field.

## Known renames

| Old name | Current name | Notes |
|---|---|---|
| `tsserver` | `ts_ls` | Renamed in nvim-lspconfig ~0.2.x; mason-lspconfig registry updated to match by 2026-05 |

As of mason-lspconfig installed commit `979befc` (2026-05), both `ensure_installed` and
`vim.lsp.config()` use `ts_ls`. The old `tsserver` name is no longer valid in either place.

## Confirm: what name does the installed registry actually use?

The mapping is built dynamically from the mason registry — there is no static file to grep.
Query it at runtime:

```bash
nvim --headless -c '
lua
local r = require("mason-registry")
for _,s in ipairs(r.get_all_package_specs()) do
  if s.name:find("<keyword>") then
    print(s.name, "lspconfig:", s.neovim and s.neovim.lspconfig or "nil")
  end
end
' -c 'q'
```

Or check the nvim-lspconfig server list for the correct lspconfig name:

```bash
ls ~/.local/share/nvim/lazy/nvim-lspconfig/lsp/ | grep -i "<keyword>"
```

## Fix

Use the same name in both places — `ensure_installed` and `vim.lsp.config()`:

```lua
ensure_installed = {
    "ts_ls",   -- lspconfig name; must match what mason registry maps to
    ...
}

vim.lsp.config('ts_ls', { capabilities = capabilities })
```
