# Scenario: nvim-treesitter API mismatch

Two opposite mismatches are possible. Always confirm which one before fixing.

## Confirm: which API does the installed plugin actually export?

```bash
ls ~/.local/share/nvim/lazy/nvim-treesitter/lua/nvim-treesitter/
# configs.lua present → old API (configs.setup) is current
# configs.lua absent  → new API (no setup, no install function yet)

grep -n "^M\.\|^function M\." ~/.local/share/nvim/lazy/nvim-treesitter/lua/nvim-treesitter/install.lua | grep -E "ensure_installed|^M\.install\b"
# M.ensure_installed present, no M.install → old API
# M.install present               → new API
```

---

## Case A — Config calls `install()` but plugin exports `ensure_installed`

**Error:** `attempt to call field 'install' (a nil value)`

The installed plugin (current master as of 2026-05) still uses the old API. A config that
was pre-updated for a hypothetical new API will crash because `install()` is not exported.

**Fix:** Revert the config function to `configs.setup()`:

```lua
config = function()
    require('nvim-treesitter.configs').setup({
        ensure_installed = {
            "json", "javascript", "typescript", "tsx",
            "yaml", "html", "css", "markdown", "markdown_inline",
            "svelte", "bash", "lua", "vim", "dockerfile",
            "gitignore", "query", "vimdoc",
            "c", "cpp", "java", "scala", "python",
        },
        highlight = { enable = true },
        indent = { enable = true },
    })

    local move = require('nvim-treesitter.textobjects.move')
    vim.keymap.set({ 'n', 'x', 'o' }, ']n',    function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
    vim.keymap.set({ 'n', 'x', 'o' }, '<C-n>', function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
    vim.keymap.set({ 'n', 'x', 'o' }, '[n',    function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
    vim.keymap.set({ 'n', 'x', 'o' }, '<C-m>', function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
end,
```

**Textobjects require path:** `require('nvim-treesitter.textobjects.move')` — the module
lives under `nvim-treesitter/lua/nvim-treesitter/textobjects/move.lua`, not under a
top-level `nvim-treesitter-textobjects` module.

---

## Case B — Config calls `configs.setup()` but `configs.lua` was removed

**Error:** `module 'nvim-treesitter.configs' not found`

The plugin was updated to a version that removed the `configs` module entirely. At that
point, `configs.setup()` is gone and highlighting/indent are handled automatically by Neovim.

**Fix:** Migrate to the new API (only valid once `configs.lua` is confirmed absent):

```lua
config = function()
    require('nvim-treesitter.install').install({
        "json", "javascript", ...
    })
    -- no trailing () — install() returns a Task table, not a callable

    local move = require('nvim-treesitter.textobjects.move')
    -- same keymaps as above
end,
```

---

## nvim-treesitter-textobjects move API

```lua
local move = require('nvim-treesitter.textobjects.move')
move.goto_next_start(query_strings, query_group?)
move.goto_next_end(query_strings, query_group?)
move.goto_previous_start(query_strings, query_group?)
move.goto_previous_end(query_strings, query_group?)
```

`query_strings` is a string (`'@function.outer'`) or list. `query_group` defaults to `'textobjects'`.
