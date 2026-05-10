# Scenario: nvim-treesitter.configs not found / attempt to call a table value

The `nvim-treesitter.configs` module was removed in the version that requires nvim 0.12+.
Any config using `require('nvim-treesitter.configs').setup({...})` will crash on startup.

A secondary error — `attempt to call a table value` — occurs when calling
`require('nvim-treesitter.install').install({...})()`. The `install` function returns an
async `Task` table, not a callable.

## Confirm

```bash
# configs module does not exist in the new version
ls ~/.local/share/nvim/lazy/nvim-treesitter/lua/nvim-treesitter/
# Expected: async.lua config.lua health.lua indent.lua init.lua install.lua log.lua parsers.lua util.lua
# No configs.lua = new API required

# What setup() accepts now (only install_dir)
grep -n "function M.setup\|install_dir" ~/.local/share/nvim/lazy/nvim-treesitter/lua/nvim-treesitter/config.lua | head -5
```

## What changed

| Old API (configs module) | New API (nvim 0.12+) |
|---|---|
| `require('nvim-treesitter.configs').setup({ highlight = {enable=true}, ... })` | Removed |
| `highlight = { enable = true }` | Automatic — nvim 0.12 enables treesitter highlighting for any buffer with an installed parser |
| `indent = { enable = true }` | Handled by `nvim-treesitter.indent` module (set indentexpr per buffer) |
| `ensure_installed = { ... }` | `require('nvim-treesitter.install').install({ ... })` |
| `sync_install`, `incremental_selection` | No equivalent in new API |
| `textobjects = { move = { ... } }` | Configure via `nvim-treesitter-textobjects.move` module directly |

## Fix

Replace the entire config function in the treesitter plugin spec:

```lua
config = function()
    -- install parsers (idempotent — skips already-installed ones)
    require('nvim-treesitter.install').install({
        "json", "javascript", "typescript", "tsx",
        "yaml", "html", "css", "markdown", "markdown_inline",
        "svelte", "bash", "lua", "vim", "dockerfile",
        "gitignore", "query", "vimdoc",
        "c", "cpp", "java", "scala", "python",
    })
    -- note: no trailing () — install() starts an async task and returns a Task table

    -- textobject keymaps via the move module directly
    local move = require('nvim-treesitter-textobjects.move')
    vim.keymap.set({ 'n', 'x', 'o' }, ']n',    function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
    vim.keymap.set({ 'n', 'x', 'o' }, '<C-n>', function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
    vim.keymap.set({ 'n', 'x', 'o' }, '[n',    function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
    vim.keymap.set({ 'n', 'x', 'o' }, '<C-m>', function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
end,
```

## Notes on the async install call

`require('nvim-treesitter.install').install({...})` starts an async task (returns a `Task`
table). Do NOT call it with a trailing `()` — that tries to invoke the returned table as a
function and crashes with `attempt to call a table value`. The async task runs in the
background; parser installation messages appear in the status line asynchronously.

`install_lang` checks `vim.list_contains(config.get_installed(), lang)` before doing any
work, so calling install on startup is idempotent and does not re-download existing parsers.

## nvim-treesitter-textobjects move module API

```lua
local move = require('nvim-treesitter-textobjects.move')
-- Available functions:
move.goto_next_start(query_strings, query_group?)
move.goto_next_end(query_strings, query_group?)
move.goto_previous_start(query_strings, query_group?)
move.goto_previous_end(query_strings, query_group?)
move.goto_next(query_strings, query_group?)
move.goto_previous(query_strings, query_group?)
```

`query_strings` accepts a string (`'@function.outer'`) or a list. `query_group` defaults to
`'textobjects'`.
