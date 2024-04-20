require("nvim-tree").setup()

-- Setting keymap separately
vim.api.nvim_set_keymap('n', '<Leader>1', ':NvimTreeToggle<CR>', {noremap = true, silent = true})
 
