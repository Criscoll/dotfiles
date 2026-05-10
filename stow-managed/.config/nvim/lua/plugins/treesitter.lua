return {
    { 'nvim-treesitter/nvim-treesitter-textobjects' },
    {
        "nvim-treesitter/nvim-treesitter",
        event = { "BufReadPre", "BufNewFile" },
        build = ":TSUpdate",
        dependencies = {
            "nvim-treesitter/nvim-treesitter-textobjects",
        },
        config = function()
            require('nvim-treesitter.install').install({
                "json", "javascript", "typescript", "tsx",
                "yaml", "html", "css", "markdown", "markdown_inline",
                "svelte", "bash", "lua", "vim", "dockerfile",
                "gitignore", "query", "vimdoc",
                "c", "cpp", "java", "scala", "python",
            })

            local move = require('nvim-treesitter-textobjects.move')
            vim.keymap.set({ 'n', 'x', 'o' }, ']n',    function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
            vim.keymap.set({ 'n', 'x', 'o' }, '<C-n>', function() move.goto_next_start('@function.outer') end,     { silent = true, desc = 'Next function start' })
            vim.keymap.set({ 'n', 'x', 'o' }, '[n',    function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
            vim.keymap.set({ 'n', 'x', 'o' }, '<C-m>', function() move.goto_previous_start('@function.outer') end, { silent = true, desc = 'Prev function start' })
        end,
    },
    {
        'nvim-treesitter/nvim-treesitter-context',
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
