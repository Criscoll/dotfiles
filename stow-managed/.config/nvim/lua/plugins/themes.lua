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
        'everviolet/nvim',
        name = 'evergarden',
        priority = 1000, -- Colorscheme plugin is loaded first before any other plugins
        opts = {
          theme = {
            variant = 'fall', -- 'winter'|'fall'|'spring'|'summer'
            accent = 'green',
          },
          editor = {
            transparent_background = false,
            sign = { color = 'none' },
            float = {
              color = 'mantle',
              invert_border = false,
            },
            completion = {
              color = 'surface0',
            },
          },
        },
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

