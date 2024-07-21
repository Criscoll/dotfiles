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
                    -- "jdtls",        -- Java LSP Server
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
            vim.api.nvim_set_keymap('n', 'gd', '<cmd>lua vim.lsp.buf.definition()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>dd', '<cmd>lua vim.lsp.buf.definition()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>dn', '<cmd>lua vim.diagnostic.goto_next()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>dp', '<cmd>lua vim.diagnostic.goto_prev()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>dh', '<cmd>lua vim.lsp.buf.hover()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>ds', '<cmd>lua vim.lsp.buf.signature_help()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>di', '<cmd>lua vim.lsp.buf.implementation()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>dr', '<cmd>lua vim.lsp.buf.references()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>da', '<cmd>lua vim.diagnostic.open_float()<CR>', { noremap = true, silent = true })
            vim.api.nvim_set_keymap('n', '<leader>dc', '<cmd>lua vim.lsp.buf.code_action()<CR>', { noremap = true, silent = true })

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
            local noop = function() end
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
                ["jdtls"] = noop,
--                    = function()
--                    lspconfig.jdtls.setup({
--                        autostart = false,
--                    })
--				end,
			})
		end,
	},
}
