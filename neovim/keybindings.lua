vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

vim.opt.syntax = "true"
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true                           
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.clipboard = "unnamedplus"
    
vim.api.nvim_set_keymap('i', '<S-Tab>', "<Esc>:tabprevious<CR>i", {noremap = true, silent = true})
