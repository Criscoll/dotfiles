return {
	{
		"williamboman/mason.nvim",
		dependencies = { "rcarriga/nvim-notify" },
		config = function()
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
					"lua_ls",
					"pylsp",
					"clangd",
					"ts_ls",
					"html",
				},
				-- automatic_enable = true (default): calls vim.lsp.enable() for each installed server
			})
		end,
	},
	{
		"mfussenegger/nvim-jdtls",
	},
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			"williamboman/mason-lspconfig.nvim",
			'hrsh7th/cmp-nvim-lsp',
			"rcarriga/nvim-notify",
		},
		config = function()
			vim.keymap.set('n', 'gd',         vim.lsp.buf.definition,     { silent = true, desc = 'Go to definition' })
			vim.keymap.set('n', '<leader>dd', vim.lsp.buf.definition,     { silent = true, desc = 'Go to definition' })
			vim.keymap.set('n', '<leader>dn', vim.diagnostic.goto_next,   { silent = true, desc = 'Next diagnostic' })
			vim.keymap.set('n', '<leader>dp', vim.diagnostic.goto_prev,   { silent = true, desc = 'Prev diagnostic' })
			vim.keymap.set('n', '<leader>dh', vim.lsp.buf.hover,          { silent = true, desc = 'Hover docs' })
			vim.keymap.set('n', '<leader>ds', vim.lsp.buf.signature_help, { silent = true, desc = 'Signature help' })
			vim.keymap.set('n', '<leader>di', vim.lsp.buf.implementation, { silent = true, desc = 'Go to implementation' })
			vim.keymap.set('n', '<leader>dr', vim.lsp.buf.references,     { silent = true, desc = 'References' })
			vim.keymap.set('n', '<leader>da', vim.diagnostic.open_float,  { silent = true, desc = 'Diagnostic float' })
			vim.keymap.set('n', '<leader>dc', vim.lsp.buf.code_action,    { silent = true, desc = 'Code action' })

			local signs = { Error = " ", Warn = " ", Hint = "󰠠 ", Info = " " }
			for type, icon in pairs(signs) do
				local hl = "DiagnosticSign" .. type
				vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
			end

			local capabilities = require('cmp_nvim_lsp').default_capabilities()

			vim.lsp.config('lua_ls', {
				capabilities = capabilities,
				settings = {
					Lua = {
						diagnostics = {
							globals = { "vim" },
						},
					},
				},
			})

			vim.lsp.config('pylsp', {
				capabilities = capabilities,
				settings = {
					pylsp = {
						plugins = {
							pyflakes    = { enabled = false },
							pylint      = { enabled = false },
							pycodestyle = { enabled = false },
							ruff        = { enabled = true },
							yapf        = { enabled = false },
							black       = { enabled = true },
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

			vim.lsp.config('clangd', {
				capabilities = capabilities,
				filetypes = { "c", "cpp", "h", "hpp" },
			})

			vim.lsp.config('ts_ls', { capabilities = capabilities })
			vim.lsp.config('html', { capabilities = capabilities })
			vim.lsp.config('svelte', { capabilities = capabilities })

			-- svelte is not mason-managed so automatic_enable won't cover it
			vim.lsp.enable('svelte')
		end,
	},
}
