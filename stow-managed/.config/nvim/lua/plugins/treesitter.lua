return {
    { 'nvim-treesitter/nvim-treesitter-textobjects' },
    {
        "nvim-treesitter/nvim-treesitter",
        lazy = false,
        build = ":TSUpdate",
        dependencies = {
            "nvim-treesitter/nvim-treesitter-textobjects",
        },
        config = function()
            require('nvim-treesitter.configs').setup({
                ensure_installed = {
                    "json", "javascript", "typescript", "tsx",
                    "yaml", "html", "css", "markdown", "markdown_inline", "mermaid",
                    "svelte", "bash", "lua", "vim", "dockerfile",
                    "gitignore", "query", "vimdoc",
                    "c", "cpp", "java", "scala", "python",
                },
                highlight = { enable = true },
                indent = { enable = true },
            })

            -- nvim 0.12 dropped the `all=false` option for directives, so nvim-treesitter's
            -- custom directives now receive TSNode[] instead of TSNode. Override them to handle
            -- both formats until nvim-treesitter ships a fix.
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

            local move = require('nvim-treesitter.textobjects.move')
            vim.keymap.set({ 'n', 'x', 'o' }, ']n',    function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
            vim.keymap.set({ 'n', 'x', 'o' }, '<C-n>', function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
            vim.keymap.set({ 'n', 'x', 'o' }, '[n',    function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
            vim.keymap.set({ 'n', 'x', 'o' }, '<C-m>', function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
        end,
    },
    {
        'nvim-treesitter/nvim-treesitter-context',
        enabled = false, -- async parse API incompatibility with nvim 0.12.1; re-enable when upstream fixes it
        dependencies = { 'nvim-treesitter/nvim-treesitter' },
        event = { 'BufReadPre', 'BufNewFile' },
        opts = {
            max_lines = 3,
        },
    },
    {
        'windwp/nvim-ts-autotag',
        dependencies = { "nvim-treesitter/nvim-treesitter" },
        config = function()
            require('nvim-ts-autotag').setup({})
        end,
        lazy = true,
        event = "VeryLazy",
    },
}
