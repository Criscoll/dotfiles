-- On Linux / MacOs this will typically be $HOME/.local/share/nvim/

-- The lazy.nvim repo should be installed here
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
print("Configured lazypath: ", lazypath)

-- Bootstrap lazy if needed
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone",
    "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",  -- Use the latest stable release
    lazypath
  })
  -- Wait or check until the clone process completes
  if vim.loop.fs_stat(lazypath) then
    print("lazy.nvim installed successfully at " .. lazypath)
  else
    error("Failed to install lazy.nvim at " .. lazypath)
    return
  end
end

if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.api.nvim_err_writeln("Error: 'lazy.nvim' path not found at " .. lazypath)
end 

vim.opt.rtp:prepend(lazypath)

-- For Debug Purposes
-- print("Lua search path: ", package.path)
-- print("Lua C search path: ", package.cpath)


-- lockfile is written to stdpath("data") (~/.local/share/nvim/lazy-lock.json) to keep
-- runtime state out of the stow-managed tree. The repo copy (lazy-lock.json next to this
-- config) is a committed snapshot for reproducible installs — copy it there to bootstrap
-- a new machine: cp ~/.config/nvim/lazy-lock.json ~/.local/share/nvim/lazy-lock.json
require('lazy').setup('plugins', {
  lockfile = vim.fn.stdpath("data") .. "/lazy-lock.json",
})



-- require('plugins.lsp-config')
-- require('plugins.nvim-tree')
-- require('plugins.nvim-telescope')

