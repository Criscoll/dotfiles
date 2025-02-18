return {
    "tpope/vim-fugitive",
    config = function ()
        vim.api.nvim_set_keymap('n', '<Leader>gb', ':Git blame<CR>', {noremap = true, silent = true})
    end
}
