# Scenario: E565 / vim.notify called during plugin config

```
E565: Not allowed to change text or change window
```

Occurs when `vim.notify` (or nvim-notify) tries to open a floating window during the lazy.nvim
plugin `config` phase — before the UI is fully ready. A secondary cause is passing a table as
the first argument instead of a string, which some nvim-notify versions reject.

## Confirm

```bash
# Find the offending notify call in telescope/other plugin configs
rg "vim\.notify" ~/.config/nvim/lua/plugins/
```

Look for:
1. First argument is a table `{ "message" }` instead of a string `"message"`
2. Call is at top level of a `config = function()` block (not deferred)

## Fix

Wrap in `vim.defer_fn` and ensure the first argument is a string:

```lua
-- before
vim.notify({ "plugin has been configured" }, "INFO", { title = 'Plugin', timeout = 2000 })

-- after
vim.defer_fn(function()
    vim.notify("plugin has been configured", vim.log.levels.INFO, {
        title = 'Plugin',
        timeout = 2000,
    })
end, 0)
```

`vim.defer_fn(..., 0)` schedules the call for after the current event loop tick, by which
point the window manager is ready to open floats.
