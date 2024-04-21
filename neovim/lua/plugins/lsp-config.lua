return {
    { 
        'williamboman/mason.nvim',
        dependencies = {
          "williamboman/mason-lspconfig.nvim"
        },
        config = function()
            -- import mason
            local mason = require("mason")
        
            -- import mason-lspconfig
            local mason_lspconfig = require("mason-lspconfig")
        
            -- enable mason and configure icons
            mason.setup({
              ui = {
                icons = {
                  package_installed = "✓",
                  package_pending = "➜",
                  package_uninstalled = "✗",
                },
              },
            })
        
            mason_lspconfig.setup({
              -- list of servers for mason to install
              ensure_installed = {
                "tsserver",
                "html",
                "cssls",
                "tailwindcss",
                "lua_ls",
                "pyright",
              },
            })
        end
    },
    {
        'williamboman/mason-lspconfig.nvim',
    },
    {
        'neovim/nvim-lspconfig',
        config = function()
            -- import lspconfig plugin
            local lspconfig = require("lspconfig")
        
            -- import mason_lspconfig plugin
            local mason_lspconfig = require("mason-lspconfig")
        
            -- Change the Diagnostic symbols in the sign column (gutter)
            local signs = { Error = " ", Warn = " ", Hint = "󰠠 ", Info = " " }
            for type, icon in pairs(signs) do
              local hl = "DiagnosticSign" .. type
              vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
            end
        
            mason_lspconfig.setup_handlers({
              -- default handler for installed servers
              function(server_name)
                lspconfig[server_name].setup({
                })
              end,
              ["lua_ls"] = function()
                -- configure lua server (with special settings)
                lspconfig["lua_ls"].setup({
                  settings = {
                    Lua = {
                      -- make the language server recognize "vim" global
                      diagnostics = {
                        globals = { "vim" },
                      },
                    },
                  },
                })
              end,
            })
        end
    }
}

