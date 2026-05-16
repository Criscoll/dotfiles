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
