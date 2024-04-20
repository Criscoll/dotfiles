vim.g.mapleader = " " -- Make sure to set `mapleader` before lazy so your mappings are correct
vim.g.maplocalleader = "\\" -- Same for `maplocalleader`

-- Set the package path to include the nvim directory
local config_path = vim.fn.stdpath('config')
package.path = package.path .. ';' .. config_path .. '/?.lua;' .. config_path .. '/?/init.lua'


-- Load in keybindings
require('keybindings')
--
-- Load in plugins
require('plugins')
                                                    




