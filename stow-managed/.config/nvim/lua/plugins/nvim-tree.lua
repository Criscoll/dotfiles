return {
    'nvim-tree/nvim-tree.lua',
    dependencies = "nvim-tree/nvim-web-devicons",
    -- init runs at startup even when lazy, ensuring netrw is disabled before it loads
    init = function()
        vim.g.loaded_netrw = 1
        vim.g.loaded_netrwPlugin = 1
    end,
    keys = {
        { '<Leader>1', '<cmd>NvimTreeToggle<CR>',   desc = 'Toggle file tree' },
        { '<leader>2', '<cmd>NvimTreeFindFile<CR>', desc = 'Reveal in file tree' },
    },
    config = function()
        local nvimtree = require('nvim-tree')
        nvimtree.setup({
            git = {
                enable = false,
            },
            view = {
              width = 70,
              relativenumber = true,
            },
            -- change folder arrow icons
            renderer = {
              indent_markers = {
                enable = true,
              },
              icons = {
                glyphs = {
                  folder = {
                    arrow_closed = "", -- arrow when folder is closed
                    arrow_open = "", -- arrow when folder is open
                  },
                },
              },
            },
            -- disable window_picker for
            -- explorer to work well with
            -- window splits
            actions = {
              open_file = {
                window_picker = {
                  enable = false,
                },
              },
            },
        })

    end
}
