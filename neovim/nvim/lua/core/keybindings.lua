vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

vim.opt.syntax = "true"
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.clipboard = "unnamedplus"

-- vim.api.nvim_set_keymap('i', '<S-Tab>', "<Esc>:tabprevious<CR>i", {noremap = true, silent = true})

vim.api.nvim_set_keymap('n', '<CR>', ":noh<CR>", {noremap = true, silent = true})

-- Unindent line in normal mode
vim.api.nvim_set_keymap('n', '<S-Tab>', '<<', { noremap = true, silent = true })

-- Unindent line in insert mode
vim.api.nvim_set_keymap('i', '<S-Tab>', '<C-o><<', { noremap = true, silent = true })

-- Unindent selected lines in visual mode
vim.api.nvim_set_keymap('v', '<S-Tab>', '<<', { noremap = true, silent = true })

-- Define :SaveSession command
vim.api.nvim_create_user_command('SaveSession', function()
  vim.cmd('mksession! ~/.config/nvim/session.vim')
end, {})

-- Define :RestoreSession command
vim.api.nvim_create_user_command('RestoreSession', function()
  vim.cmd('source ~/.config/nvim/session.vim')
end, {})

vim.api.nvim_create_user_command('PWD', function()
  vim.cmd('!echo %')
end, {})

-- Define :ClearMarks command
vim.api.nvim_create_user_command('ClearMarks', function()
  vim.cmd(':delm! | delm A-Z0-9')
end, {})


