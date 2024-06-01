return {
	{
		"williamboman/mason.nvim",
		config = function()
			-- import mason
			local status, mason = pcall(require, "mason")
			if not status then
				print("Failed to load mason")
				return
			end
			print("mason loaded successfully")

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
		end,
	},
	{
		"williamboman/mason-lspconfig.nvim",
		dependencies = { "williamboman/mason.nvim" },
		config = function()
			local status, mason_lspconfig = pcall(require, "mason-lspconfig")
			if not status then
				print("Failed to load mason-lspconfig")
				return
			end
			print("mason-lspconfig loaded successfully")

			mason_lspconfig.setup({
				ensure_installed = {
					"tsserver",
					"html",
					"cssls",
					"tailwindcss",
					"lua_ls",       -- Lua LSP Server
					"pylsp",        -- Python LSP Server
                    "clangd",       -- C++ LSP Server
                    "jdtls",        -- Java LSP Server
				},
			})
		end,
	},
	{
		"neovim/nvim-lspconfig",
		dependencies = { "williamboman/mason-lspconfig.nvim" },
		config = function()
			-- import lspconfig plugin
			local status, lspconfig = pcall(require, "lspconfig")
			if not status then
				print("Failed to load lspconfig")
				return
			end
			print("lspconfig loaded succesfully")

			-- import mason_lspconfig plugin
			local status, mason_lspconfig = pcall(require, "mason-lspconfig")
			if not status then
				print("Failed to load mason-lspconfig")
				return
			end

			-- Change the Diagnostic symbols in the sign column (gutter)
			local signs = { Error = " ", Warn = " ", Hint = "󰠠 ", Info = " " }
			for type, icon in pairs(signs) do
				local hl = "DiagnosticSign" .. type
				vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = "" })
			end

			mason_lspconfig.setup_handlers({
				-- default handler for installed servers
				function(server_name)
					lspconfig[server_name].setup({})
				end,
				["lua_ls"] = function()
					-- configure lua server (with special settings)
					lspconfig.lua_ls.setup({
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
					lspconfig.clangd.setup({})
				end,
                ["jdtls"] = function()
					lspconfig.jdtls.setup({})
				end,
			})
		end,
	},
}
