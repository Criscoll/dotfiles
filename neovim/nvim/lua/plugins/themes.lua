return {
   'rebelot/kanagawa.nvim',
    config = function()
        require("kanagawa").setup({
            colors = {
                theme = {
                    all = {
                        ui = {
                            bg_gutter = "none",
                        }
                    }
                }
            }
        })

        vim.cmd("colorscheme kanagawa")
        -- Set custom highlights for Tree-sitter groups
        vim.cmd [[
            highlight! @keyword.return guibg=NONE
            highlight! @keyword guibg=NONE
            highlight! @constant guibg=NONE
            highlight! @comment guibg=NONE
            " Add other Tree-sitter highlight groups as necessary
        ]]

    end
}

