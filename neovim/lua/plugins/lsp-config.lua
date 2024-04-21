return {
    { 
        'williamboman/mason.nvim',
        config = function()
            ui = {
                icons = {
                    package_installed = "✓",
                    package_pending = "➜",
                    package_uninstalled = "✗"
                }
            }
        end

    },
    { 
        'williamboman/mason-lspconfig.nvim',
        config = function()
            ensure_installed = { "lua_ls" }
        end
    },
    { 
        'neovim/nvim-lspconfig'
    }
}

