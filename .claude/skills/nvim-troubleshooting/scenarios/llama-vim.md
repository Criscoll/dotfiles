# Scenario: llama.vim config deprecation warnings

llama.vim prints deprecation warnings on startup when `vim.g.llama_config` uses old field names.

## Known deprecations

| Old field | New field |
|---|---|
| `endpoint` | `endpoint_fim` |

## Confirm

```bash
grep -n "endpoint" ~/.config/nvim/lua/plugins/llama-vim.lua
```

## Fix

In `stow-managed/.config/nvim/lua/plugins/llama-vim.lua`:

```lua
-- Before
vim.g.llama_config = {
    endpoint = "http://127.0.0.1:8012/infill",
    auto_fim = false,
}

-- After
vim.g.llama_config = {
    endpoint_fim = "http://127.0.0.1:8012/infill",
    auto_fim = false,
}
```

## Finding current field names

```bash
grep -n "endpoint\|config" ~/.local/share/nvim/lazy/llama.vim/lua/llama.lua 2>/dev/null | head -20
```
