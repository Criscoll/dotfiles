return {
    'nvim-tree/nvim-tree.lua',
    dependencies = "nvim-tree/nvim-web-devicons",
    config = function()
        -- recommended settings from nvim-tree documentation
        vim.g.loaded_netrw = 1
        vim.g.loaded_netrwPlugin = 1

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

        vim.api.nvim_set_keymap('n', '<Leader>1', ':NvimTreeToggle<CR>', {noremap = true, silent = true})
        vim.api.nvim_set_keymap('n', '<leader>2', ':NvimTreeFindFile<CR>', { noremap = true, silent = true })
    end
}
