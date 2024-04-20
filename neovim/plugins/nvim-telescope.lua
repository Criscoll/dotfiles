require('telescope').setup {
  pickers = {
    find_files = {
        find_command = { 'fd', '--type', 'f', '--hidden', '--exclude', '.git' }
    },
    live_grep = {
        grep_command = 'rg',
        grep_args = { '--color=always', '--with-filename', '--line-number', '--column' },
        additional_args = function(opts)
            return {'--hidden'}
        end
    }
  }
}

vim.api.nvim_set_keymap('n', '<Leader>ff', ':Telescope find_files<CR>', {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<Leader>fb', ':Telescope buffers<CR>', {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<Leader>fg', ':Telescope live_grep<CR>', {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<Leader>fs', ':Telescope grep_string<CR>', {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<Leader>fc', ':Telescope current_buffer_fuzzy_find<CR>', {noremap = true, silent = true})
