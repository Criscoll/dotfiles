-- Example using a list of specs with the default options
vim.g.mapleader = " " -- Make sure to set `mapleader` before lazy so your mappings are correct
vim.g.maplocalleader = "\\" -- Same for `maplocalleader`
vim.opt.syntax = "true"
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true

vim.api.nvim_set_keymap('i', '<S-Tab>', ':tabprevious<CR>', {noremap = true, silent = true})

                                                
-- On Linux / MacOs this will typically be $HOME/.local/share/nvim/
-- The lazy.nvim repo should be installed here
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

-- The below block will check to see if lazy is installed in the expected directory
-- otherwise it will try to bootstrap it from a latest github fetch
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({
    "git",
    "clone",
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


-- Must be below the above code to work properly
require("lazy").setup(({
    {
        "neoclide/coc.nvim",
    }
}))


