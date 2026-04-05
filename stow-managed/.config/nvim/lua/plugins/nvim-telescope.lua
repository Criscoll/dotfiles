return {
    {
        'nvim-telescope/telescope-fzf-native.nvim', build = 'make'
    },
    {
        'nvim-telescope/telescope.nvim',
        dependencies = {
             'nvim-lua/plenary.nvim',
             "nvim-tree/nvim-web-devicons",
             'nvim-telescope/telescope-fzf-native.nvim',
             'rcarriga/nvim-notify',
         },
        keys = {
            -- File Search
            { '<Leader>ff',  '<cmd>Telescope find_files<CR>',                                                             desc = 'Find files' },
            { '<Leader>fz',  function() require('telescope.builtin').find_files({ prompt_title = "Find Files (Hidden Included)", find_command = {'rg', '--files', '-uu'} }) end, desc = 'Find files (hidden)' },
            { '<Leader>fd',  function() local cwd = vim.fn.expand('%:p:h') require('telescope.builtin').find_files({ prompt_title = "Find Files in (" .. cwd .. ")", cwd = cwd }) end, desc = 'Find files in buffer dir' },
            { '<Leader>ftf', function()
                local node = require('nvim-tree.api').tree.get_node_under_cursor()
                if not node then vim.notify("Selected node is not a directory") return end
                local cwd = node.absolute_path
                if not vim.fn.isdirectory(cwd) then vim.notify("Selected node is not a directory") return end
                require('telescope.builtin').find_files({ prompt_title = "Find files in (" .. cwd .. ")", cwd = cwd })
            end, desc = 'Find files in tree dir' },
            { '<Leader>fe',  function() require('telescope.builtin').find_files({ prompt_title = "Find files in workbench", cwd = "/home/cristian/Documents/Obsidian/02_Workbench" }) end, desc = 'Find workbench note' },

            -- Buffer / History Search
            { '<Leader>fb',  '<cmd>Telescope buffers<CR>',                                                                desc = 'Open buffers' },
            { '<Leader>fh',  function()
                require('telescope.builtin').buffers(require('telescope.themes').get_cursor({
                    prompt_title = 'call stack', sort_mru = true, ignore_current_buffer = true,
                    layout_config = { width = 0.5, vertical = 0.5, preview_width = 0.3 },
                    path_display = { "tail" },
                }))
            end, desc = 'Buffer history' },
            { '<Leader>fj',  function() require('telescope.builtin').jumplist({ sort_mru = true, path_display = { "tail" } }) end, desc = 'Jump list' },

            -- Grep / Code Fuzzy Search
            { '<Leader>fst', '<cmd>Telescope treesitter<CR>',                                                             desc = 'Treesitter symbols' },
            { '<Leader>fsc', '<cmd>Telescope current_buffer_fuzzy_find<CR>',                                              desc = 'Fuzzy find in buffer' },
            { '<Leader>fss', '<cmd>Telescope grep_string<CR>',                                                            desc = 'Grep word under cursor' },
            { '<Leader>fsl', '<cmd>Telescope live_grep<CR>',                                                              desc = 'Live grep' },
            { '<Leader>fsp', function()
                local term = vim.fn.input("Search for: ")
                if term ~= "" then
                    require('telescope.builtin').grep_string({ prompt_title = "Find String (" .. term .. ")", search = term })
                end
            end, desc = 'Prompted grep' },
            { '<Leader>fsb', function()
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in Open Buffers", grep_open_files = true,
                    mappings = { i = { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine } },
                })
            end, desc = 'Live grep open buffers' },
            { '<Leader>ftl', function()
                local node = require('nvim-tree.api').tree.get_node_under_cursor()
                if not node then vim.notify("Selected node is not a directory") return end
                local cwd = node.absolute_path
                if not vim.fn.isdirectory(cwd) then vim.notify("Selected node is not a directory") return end
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in (" .. cwd .. ")", cwd = cwd,
                    mappings = { i = { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine } },
                })
            end, desc = 'Live grep in tree dir' },
            { '<Leader>fsd', function()
                local cwd = vim.fn.expand('%:p:h')
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in (" .. cwd .. ")", cwd = cwd,
                    mappings = { i = { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine } },
                })
            end, desc = 'Live grep in buffer dir' },
            { '<Leader>fsn', function()
                local cwd = "/home/cristian/Documents/Obsidian/01_Notes"
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in (" .. cwd .. ")", cwd = cwd,
                    mappings = { i = { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine } },
                })
            end, desc = 'Live grep notes' },
            { '<Leader>fse', function()
                local cwd = "/home/cristian/Documents/Obsidian/02_Workbench"
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in (" .. cwd .. ")", cwd = cwd,
                    mappings = { i = { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine } },
                })
            end, desc = 'Live grep workbench' },

            -- Util Pickers
            { '<Leader>fm',  '<cmd>Telescope marks<CR>',                                                                  desc = 'Marks' },
            { '<Leader>fur', '<cmd>Telescope resume<CR>',                                                                 desc = 'Resume last picker' },
            { '<Leader>fup', '<cmd>Telescope pickers<CR>',                                                                desc = 'Previous pickers' },
            { '<Leader>fuc', '<cmd>Telescope commands<CR>',                                                               desc = 'Commands' },
            { '<Leader>fut', '<cmd>Telescope help_tags<CR>',                                                              desc = 'Help tags' },
            { '<Leader>fum', '<cmd>Telescope man_pages<CR>',                                                              desc = 'Man pages' },

            -- LSP Search
            { '<Leader>gr',  '<cmd>Telescope lsp_incoming_calls<CR>',                                                     desc = 'LSP incoming calls' },
            { '<Leader>gd',  '<cmd>Telescope lsp_definitions<CR>',                                                        desc = 'LSP definitions' },
            { '<Leader>gi',  '<cmd>Telescope lsp_implementations<CR>',                                                    desc = 'LSP implementations' },
            { '<Leader>flc', '<cmd>Telescope lsp_incoming_calls<CR>',                                                     desc = 'LSP incoming calls' },
            { '<Leader>flr', '<cmd>Telescope lsp_references<CR>',                                                         desc = 'LSP references' },
            { '<Leader>fli', '<cmd>Telescope lsp_implementations<CR>',                                                    desc = 'LSP implementations' },
            { '<Leader>fld', '<cmd>Telescope diagnostics<CR>',                                                            desc = 'Diagnostics' },
            { '<Leader>fls', '<cmd>Telescope lsp_document_symbols<CR>',                                                   desc = 'LSP document symbols' },

            -- Git Search
            { '<Leader>fgs', '<cmd>Telescope git_status<CR>',                                                             desc = 'Git status' },
            { '<Leader>fgc', '<cmd>Telescope git_commits<CR>',                                                            desc = 'Git commits' },
            { '<Leader>fgb', '<cmd>Telescope git_bcommits<CR>',                                                           desc = 'Git buffer commits' },
            { '<Leader>fgv', '<cmd>Telescope git_bcommits_range<CR>',                                                     desc = 'Git commits range' },
        },
        config = function()
            require('telescope').setup{
                defaults = {
                    layout_strategy='vertical',
                    preview = { treesitter = false },
                },
                vimgrep_arguments = {
                    'rg',
                    '--color=always',
                    '--no-heading',
                    '--with-filename',
                    '--line-number',
                    '--column',
                    '--smart-case'
                },
                pickers = {
                    find_files = {
                        find_command = { 'rg', '--files', '--glob', '!**/venv/**', '--glob', '!**/node_modules/**' }
                    },
                    live_grep = {
                        file_ignore_patterns = { 'node_modules', '.git', 'venv', 'node_modules' },
                        grep_command = 'rg',
                        grep_args = { '--color=always', '--with-filename', '--line-number', '--column', '--no-ignore'},
                        mappings = {
                            i =  { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine }
                        },
                    }
                },
                extensions = {
                    fzf = {
                        fuzzy = true,
                        override_generic_sorter = true,
                        override_file_sorter = true,
                        case_mode = "smart_case",
                    }
                }
            }

            require('telescope').load_extension('fzf')

            vim.notify({ "nvim-telescope has been configured" }, "INFO", {
              title = 'Plugin Ready | nvim-telescope',
              timeout = 2000,
            })
        end
    }
}
