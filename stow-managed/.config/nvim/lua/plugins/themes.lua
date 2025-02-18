return {
    {
        'rebelot/kanagawa.nvim',
        lazy = false,
         config = function()
             require("kanagawa").setup({
                 colors = {
                     theme = {
                         all = {
                             ui = {
                                 bg_gutter = "none",
                             }
                         }
                     }
                 }
             })

             -- Set custom highlights for Tree-sitter groups
             -- vim.cmd [[
             --     highlight! @keyword.return guibg=NONE
             --     highlight! @keyword guibg=NONE
             --     highlight! @constant guibg=NONE
             --     highlight! @comment guibg=NONE
             --     " Add other Tree-sitter highlight groups as necessary
             -- ]]

         end
    },
    {
        'catppuccin/nvim',
        lazy = false,
        name = 'catppuccin',
        priority = 10000
    },
    {
        'sainnhe/everforest',
        lazy = false,
        priority = 1000,
--        config = function ()
--            require('everforest').setup({
--                everforest_background = 'hard',
--            })
--        end
    },
    {
        'savq/melange-nvim',
        lazy = false,
        priority = 1000,
    },
    {
        'AlexvZyl/nordic.nvim',
        lazy = false,
        priority = 1000,
    },
    {
        'rmehri01/onenord.nvim',
        lazy = false,
        priority = 1000,
    }
}

