return {
	{
		"williamboman/mason.nvim",
		dependencies = { "rcarriga/nvim-notify" }, -- ensure nvim-notify loaded first to hook into lsp message handler 
		config = function()
			-- import mason
			local status, mason = pcall(require, "mason")

			if not status then
			    vim.notify("Failed to load Mason", "ERROR", { title = 'lsp-config.lua' })
				return
			end

			mason.setup({
				ui = {
					icons = {
						package_installed = "✓",
						package_pending = "➜",
						package_uninstalled = "✗",
					},
				},
			})
		end,
	},
	{
		"williamboman/mason-lspconfig.nvim",
		dependencies = { "williamboman/mason.nvim", "rcarriga/nvim-notify" },
		config = function()
			local status, mason_lspconfig = pcall(require, "mason-lspconfig")

			if not status then
			    vim.notify("Failed to load mason-lspconfig", "ERROR", { title = 'lsp-config.lua' })
				return
			end

			mason_lspconfig.setup({
				ensure_installed = {
					"lua_ls",       -- Lua LSP Server
					"pylsp",        -- Python LSP Server
                    "clangd",       -- C++ LSP Server
                    "tsserver",
                    "html",
				},
			})
		end,
	},
    {
        "mfussenegger/nvim-jdtls", -- java is special and needs some more effort to setup properly. See java.lua
    },
	{
		"neovim/nvim-lspconfig",
		dependencies =
            {
            "williamboman/mason-lspconfig.nvim",
            'hrsh7th/cmp-nvim-lsp',             -- used to setup nvim-cmp lsp capabilities
            "rcarriga/nvim-notify"              -- ensure nvim-notify loaded first to hook into lsp message handler
            },
		config = function()
            vim.keymap.set('n', 'gd',          vim.lsp.buf.definition,        { silent = true, desc = 'Go to definition' })
            vim.keymap.set('n', '<leader>dd', vim.lsp.buf.definition,        { silent = true, desc = 'Go to definition' })
            vim.keymap.set('n', '<leader>dn', vim.diagnostic.goto_next,      { silent = true, desc = 'Next diagnostic' })
            vim.keymap.set('n', '<leader>dp', vim.diagnostic.goto_prev,      { silent = true, desc = 'Prev diagnostic' })
            vim.keymap.set('n', '<leader>dh', vim.lsp.buf.hover,             { silent = true, desc = 'Hover docs' })
            vim.keymap.set('n', '<leader>ds', vim.lsp.buf.signature_help,    { silent = true, desc = 'Signature help' })
            vim.keymap.set('n', '<leader>di', vim.lsp.buf.implementation,    { silent = true, desc = 'Go to implementation' })
            vim.keymap.set('n', '<leader>dr', vim.lsp.buf.references,        { silent = true, desc = 'References' })
            vim.keymap.set('n', '<leader>da', vim.diagnostic.open_float,     { silent = true, desc = 'Diagnostic float' })
            vim.keymap.set('n', '<leader>dc', vim.lsp.buf.code_action,       { silent = true, desc = 'Code action' })

			local status, lspconfig = pcall(require, "lspconfig")
			if not status then
			    vim.notify("Failed to load lspconfig", "ERROR", { title = 'lsp-config.lua' })
				return
			end

			-- import mason_lspconfig plugin
			local status, mason_lspconfig = pcall(require, "mason-lspconfig")
			if not status then
			    vim.notify("Failed to load mason-lspconfig", "ERROR", { title = 'lsp-config.lua' })
				return
			end

			-- Change the Diagnostic symbols in the sign column (gutter)
			local signs = { Error = " ", Warn = " ", Hint = "󰠠 ", Info = " " }
			for type, icon in pairs(signs) do
				local hl = "DiagnosticSign" .. type
				vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
			end

            local capabilities = require('cmp_nvim_lsp').default_capabilities()
			mason_lspconfig.setup_handlers({
				-- default handler for installed servers
				function(server_name)
					lspconfig[server_name].setup({})
				end,
				["lua_ls"] = function()
					-- configure lua server (with special settings)
					lspconfig.lua_ls.setup({
                        capabilities = capabilities,
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
				["pylsp"] = function()
					lspconfig.pylsp.setup({
                        capabilities = capabilities,
						settings = {
                            pylsp = {
                                plugins = {
                                    pyflakes = { enabled = false },
                                    pylint= { enabled = false },
                                    pycodestyle = { enabled = false },
                                    ruff = { enabled = true },
                                    yapf = { enabled = false },
                                    black = { enabled = true },
                                },
                            },
							python = {
								analysis = {
									typeCheckingMode = "strict",
									autoSearchPaths = true,
									useLibraryCodeForTypes = true,
								},
							},
						},
					})
				end,
                ["clangd"] = function()
					lspconfig.clangd.setup({
                        capabilities = capabilities,
                        filetypes = {"c", "cpp", "h", "hpp"},
                        root_dir = function(fname)
                            return require('lspconfig.util').root_pattern("compile_commands.json", ".git")(fname) or vim.fn.getcwd()
                        end
                    })
				end,
                ["tsserver"] = function()
                	lspconfig.tsserver.setup({
                        capabilities = capabilities
                    })
                end,
                ["html"] = function()
                	lspconfig.html.setup({
                        capabilities = capabilities
                    })
                end,
                ["svelte-language-server"] = function()
                	lspconfig.svelte.setup({
                        capabilities = capabilities
                    })
                end,
            })
		end,
	},
}
