local mason = require('mason-registry')
local jdtls_path = mason.get_package('jdtls'):get_install_path()
local equinox_launcher_path =
    vim.fn.glob(jdtls_path .. '/plugins/org.eclipse.equinox.launcher_*.jar')

local system = 'linux'
local config_path = vim.fn.glob(jdtls_path .. '/config_' .. system)

-- If you started neovim within `~/dev/xy/project-1` this would resolve to `project-1`
local project_name = vim.fn.fnamemodify(vim.fn.getcwd(), ':p:h:t')
local workspace_dir = '/home/.cache/jdtls/workspace_' .. project_name
local project_roots = {             -- Add your java projects here to help LSP find project root
}
local function find_project_root(fname)
    for _, root in ipairs(project_roots) do
        if fname:find(root, 1, true) then
            return root
        end
    end

    vim.notify("Unable to determine project root_dir", "WARN", { title = "lsp-config.lua" })
    return vim.fs.root(0, {".git", "mvnw", "gradlew"})
end

local config = {
  -- The command that starts the language server
  cmd = {
    'java', -- or '/path/to/java17_or_newer/bin/java'
            -- depends on if `java` is in your $PATH env variable and if it points to the right version.
    '-Declipse.application=org.eclipse.jdt.ls.core.id1',
    '-Dosgi.bundles.defaultStartLevel=4',
    '-Declipse.product=org.eclipse.jdt.ls.core.product',
    '-Dlog.protocol=true',
    '-Dlog.level=WARN',
    '-Xms1g',
    '-Xmx8g',
    '--add-modules=ALL-SYSTEM',
    '--add-opens', 'java.base/java.util=ALL-UNNAMED',
    '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
    -- 💀
    '-jar', equinox_launcher_path,
         -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         -- Must point to the
         -- eclipse.jdt.ls installation
    -- 💀
    '-configuration', config_path,
                    -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^        ^^^^^^
                    -- Must point to the                      Change to one of `linux`, `win` or `Mac`
                    -- eclipse.jdt.ls installation            Depending on your system.
    '-data', workspace_dir,
  },
  root_dir = find_project_root(vim.api.nvim_buf_get_name(0)),
  capabilities = require('cmp_nvim_lsp').default_capabilities(),
    settings = {
        java = {
            server = { launchMode = 'Hybrid' },
            eclipse = {
                downloadSources = true,
            },
            maven = {
                downloadSources = true,
            },
            -- configuration = {
            --     runtimes = {
            --         {
            --             name = 'JavaSE-1.8',
            --             path = '~/.sdkman/candidates/java/8.0.402-tem',
            --         },
            --         {
            --             name = 'JavaSE-11',
            --             path = '~/.sdkman/candidates/java/11.0.22-tem',
            --         },
            --         {
            --             name = 'JavaSE-17',
            --             path = '~/.sdkman/candidates/java/17.0.10-tem',
            --         },
            --         {
            --             name = 'JavaSE-21',
            --             path = '~/.sdkman/candidates/java/21.0.3-tem',
            --         },
            --     },
            -- },
            references = {
                includeDecompiledSources = true,        -- LSP will include decompiled sources for references
            },
            implementationsCodeLens = {
                enabled = false,
            },
            referenceCodeLens = {
                enabled = false,
            },
            inlayHints = {
                parameterNames = {
                    enabled = 'none',
                },
            },
            signatureHelp = {
                enabled = true,
                description = {
                    enabled = true,
                },
            },
            sources = {
                organizeImports = {
                    starThreshold = 9999,
                    staticStarThreshold = 9999,
                },
            },
        },
        redhat = { telemetry = { enabled = false } },
    },
}
-- This starts a new client & server,
-- or attaches to an existing client & server depending on the `root_dir`.
require('jdtls').start_or_attach(config)
