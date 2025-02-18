-- vim.lsp.set_log_level("debug")
vim.g.mapleader = " " -- Make sure to set `mapleader` before lazy so your mappings are correct
vim.g.maplocalleader = "\\" -- Same for `maplocalleader`
vim.o.termguicolors = true
vim.o.ignorecase = true
vim.o.smartcase = true
vim.opt.clipboard = 'unnamedplus'
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.wrap = false
vim.opt.colorcolumn = "100"
vim.opt.textwidth = 100
vim.opt.autoindent = true
-- vim.o.formatlistpat = [[^\s*\d\+[\]:.)]\s\+\|^\s*[-*+]\s\+]]
-- vim.o.formatoptions = vim.o.formatoptions .. 'n'

-- Set the package path to include the nvim directory
-- local config_path = vim.fn.stdpath('config')
-- package.path = package.path .. ';' .. config_path .. '/?.lua;' .. config_path .. '/?/init.lua'


-- Load in keybindings
require("core")

-- Load in plugins
require("lazy-plugin-manager")

-- Load in snippets
require("snippets")

-- Set default colorscheme
vim.cmd("colorscheme catppuccin")

-- Enabel gx url opening for unix
if vim.fn.has("unix") == 1 then
  vim.api.nvim_set_keymap('n', 'gx', ':silent execute "!xdg-open " . shellescape(expand("<cfile>"), 1)<CR><CR>', { noremap = true, silent = true })
end

