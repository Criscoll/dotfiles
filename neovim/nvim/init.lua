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


-- Set the package path to include the nvim directory
-- local config_path = vim.fn.stdpath('config')
-- package.path = package.path .. ';' .. config_path .. '/?.lua;' .. config_path .. '/?/init.lua'

-- Load in keybindings
require("core")

-- Load in plugins
require("lazy-plugin-manager")

-- Set default colorscheme
vim.cmd("colorscheme everforest")

-- URL handling
local map = vim.api.nvim_set_keymap
local opts = { noremap = true, silent = true }

if vim.fn.has("mac") == 1 then
  map('', 'gx', '<Cmd>lua os.execute("open " .. vim.fn.expand("<cfile>"))<CR>', opts)
elseif vim.fn.has("unix") == 1 then
  map('', 'gx', '<Cmd>lua os.execute("xdg-open " .. vim.fn.expand("<cfile>"))<CR>', opts)
else
  map('', 'gx', '<Cmd>lua print("Error: gx is not supported on this OS!")<CR>', opts)
end

