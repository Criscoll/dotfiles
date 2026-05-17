# Scenario: nvim-treesitter directive API mismatch (Neovim 0.12+)

## Symptoms

```
Decoration provider "start" (ns=nvim.treesitter.highlighter):
Lua: ...languagetree.lua:215: ...treesitter.lua:196: attempt to call method 'range' (a nil value)
stack traceback:
        [C]: in function 'f'
        ...languagetree.lua:215: in function 'tcall'
        ...languagetree.lua:596: in function 'parse'
        ...highlighter.lua:580: in function <...highlighter.lua:557>
```

The traceback is truncated — the real crash is inside an async coroutine (`coroutine.wrap`)
and inner frames are invisible. The error originates in a treesitter directive handler that
receives `TSNode[]` but passes it to `vim.treesitter.get_node_text()` expecting a `TSNode`.

Triggered by opening a markdown file with fenced code blocks (especially `mermaid`, `python`,
or any language that uses injection queries).

## Root cause

Neovim 0.12 dropped the `all = false` option for `add_directive`. In Neovim ≤ 0.11, a plugin
could pass `{ force = true, all = false }` to receive a single `TSNode` per capture. In 0.12,
`add_directive` ignores `all` entirely and always passes `TSNode[]` (a list).

nvim-treesitter registers several directives with `all = false` but indexes the match table
as if it still returns a single node:

```lua
-- broken: match[id] is now TSNode[], not TSNode
local node = match[capture_id]
vim.treesitter.get_node_text(node, bufnr)  -- node is a list → crash
```

Affected directives: `set-lang-from-info-string!`, `set-lang-from-mimetype!`, `downcase!`

## Confirm

```bash
# Check Neovim version
nvim --version | head -1   # must be v0.12+

# Confirm add_directive ignores 'all' in this version
nvim --headless -c '
  lua vim.fn.writefile(
    vim.fn.readfile(vim.fn.expand("$VIMRUNTIME") .. "/lua/vim/treesitter/query.lua"),
    "/tmp/nvim_query.lua"
  )
' -c 'q'
# Read /tmp/nvim_query.lua and search for add_directive — if there is no wrapping of the
# handler for the `all` option, the plugin's old-style handlers will receive lists.
```

Also confirm nvim-treesitter still uses the old pattern:

```bash
grep -n "local node = match\[" \
  ~/.local/share/nvim/lazy/nvim-treesitter/lua/nvim-treesitter/query_predicates.lua
# If you see bare match[id] assignments (no [1] indexing), the plugin is affected.
```

## Fix

Override the three broken directives in your treesitter config **after**
`require('nvim-treesitter.configs').setup(...)` so `force = true` replaces nvim-treesitter's
version:

```lua
-- In lua/plugins/treesitter.lua, inside the config = function()
if vim.fn.has("nvim-0.12") == 1 then
    local ts_query = require("vim.treesitter.query")
    local html_types = {
        importmap = "json", module = "javascript",
        ["application/ecmascript"] = "javascript",
        ["text/ecmascript"] = "javascript",
    }
    local lang_aliases = {
        ex = "elixir", pl = "perl", sh = "bash",
        uxn = "uxntal", ts = "typescript",
    }
    local function resolve_lang(alias)
        local ft = vim.filetype.match({ filename = "a." .. alias })
        return ft or lang_aliases[alias] or alias
    end
    local function get_node(match, id)
        local v = match[id]
        if not v then return nil end
        return (type(v) == "table" and vim.islist(v)) and v[1] or v
    end
    ts_query.add_directive("set-lang-from-info-string!", function(match, _, bufnr, pred, metadata)
        local node = get_node(match, pred[2])
        if not node then return end
        local alias = vim.treesitter.get_node_text(node, bufnr):lower()
        metadata["injection.language"] = resolve_lang(alias)
    end, { force = true })
    ts_query.add_directive("set-lang-from-mimetype!", function(match, _, bufnr, pred, metadata)
        local node = get_node(match, pred[2])
        if not node then return end
        local val = vim.treesitter.get_node_text(node, bufnr)
        if html_types[val] then
            metadata["injection.language"] = html_types[val]
        else
            local parts = vim.split(val, "/", {})
            metadata["injection.language"] = parts[#parts]
        end
    end, { force = true })
    ts_query.add_directive("downcase!", function(match, _, bufnr, pred, metadata)
        local id = pred[2]
        local node = get_node(match, id)
        if not node then return end
        local text = vim.treesitter.get_node_text(node, bufnr, { metadata = metadata[id] }) or ""
        if not metadata[id] then metadata[id] = {} end
        metadata[id].text = string.lower(text)
    end, { force = true })
end
```

## Removal condition

Remove this override once nvim-treesitter ships a fix. Monitor
`nvim-treesitter/lua/nvim-treesitter/query_predicates.lua` — when the directives use
`nodes = match[id]; node = nodes[1]` (the Neovim 0.12 built-in pattern), the override
can be deleted.
