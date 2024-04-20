-- On Linux / MacOs this will typically be $HOME/.local/share/nvim/
-- The lazy.nvim repo should be installed here
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

-- The below block will check to see if lazy is installed in the expected directory
-- otherwise it will try to bootstrap it from a latest github fetch
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", -- latest stable release
    lazypath,
  })
end

if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.api.nvim_err_writeln("Error: 'lazy.nvim' path not found at " .. lazypath)
end 

vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
    { 'williamboman/mason.nvim' },
    { 'williamboman/mason-lspconfig.nvim' },
    { 'neovim/nvim-lspconfig' },
    { 'nvim-tree/nvim-tree.lua' },
    { 'nvim-lua/plenary.nvim' },
    -- { 'nvim-treesitter/nvim-treesitter' }, something isn't working here
    { 'nvim-telescope/telescope.nvim' }
})

require('plugins.lsp-config')
require('plugins.nvim-tree')
require('plugins.nvim-telescope')








