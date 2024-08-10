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
         config = function()
            require('telescope').setup{
                defaults = {
                    layout_strategy='vertical',
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
                        find_command = { 'rg', '--files', '--glob', '!**/venv/**' }
                    },
                    live_grep = {
                        file_ignore_patterns = { 'node_modules', '.git', 'venv' },
                        grep_command = 'rg',
                        grep_args = { '--color=always', '--with-filename', '--line-number', '--column', '--no-ignore'},
                        mappings = {
                            i =  { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine } -- shortcut to fuzzy refine the search
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

            require('telescope').load_extension('fzf')      -- load native fzf extension

            -- function to find_files with hidden files and directories included in search
            _G.find_files_with_hidden = function()
                require('telescope.builtin').find_files({
                    prompt_title = "Find Files (Hidden Included)",
                    find_command = {'rg', '--files', '-uu'}
                })
            end

            -- Function to prompt for a search term and invoke find_string
            _G.prompt_and_search = function()
              local term = vim.fn.input("Search for: ")
              if term ~= "" then
                require('telescope.builtin').grep_string({
                  prompt_title = "Find String (" .. term .. ")",
                  search = term,
                })
              end
            end

            _G.search_buffer_history = function()
                local stackOptions = {
                    prompt_title = 'call stack',
                    sort_mru = true,
                    ignore_current_buffer = true,
                    layout_config = {
                        width = 0.5,
                        vertical = 0.5,
                        preview_width = 0.3,
                    },
                    path_display = { "tail" },
                }
                require('telescope.builtin').buffers(require('telescope.themes').get_cursor(stackOptions))
            end

            _G.live_grep_open_buffers = function ()
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in Open Buffers",
                    grep_open_files = true, -- only grep opened buffers
                        mappings = {
                            i =  { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine }, -- shortcut to fuzzy refine the search
                        },
                })
            end

            _G.search_directory_files = function ()
                local cwd = vim.fn.expand('%:p:h')
                require('telescope.builtin').find_files({
                    prompt_title = "Find Files in (" .. cwd .. ")",
                    cwd = cwd,
                })
            end

            _G.live_grep_current_directory_files= function ()
                local cwd = vim.fn.expand('%:p:h')
                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in in (" .. cwd .. ")",
                    cwd = cwd,
                    mappings = {
                        i =  { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine }, -- shortcut to fuzzy refine the search
                    },
                })
            end

            _G.search_jump_list = function ()
                local stackOptions = {
                    sort_mru = true,
                    path_display = { "tail" },
                }
                require('telescope.builtin').jumplist(stackOptions)
            end

            local nvim_tree = require('nvim-tree.api')
            _G.search_nvim_tree_directory_files = function ()
                local node = nvim_tree.tree.get_node_under_cursor()
                if not node then
                    vim.notify("Selected node is not a directory")
                    return
                end

                local cwd = node.absolute_path
                if not vim.fn.isdirectory(cwd) then
                    vim.notify("Selected node is not a directory")
                    return
                end

                require('telescope.builtin').find_files({
                    prompt_title = "Find files in (" .. cwd .. ")",
                    cwd = cwd,
                })
            end


            _G.live_grep_nvim_tree_directory_files = function ()
                local node = nvim_tree.tree.get_node_under_cursor()
                if not node then
                    vim.notify("Selected node is not a directory")
                    return
                end

                local cwd = node.absolute_path
                if not vim.fn.isdirectory(cwd) then
                    vim.notify("Selected node is not a directory")
                    return
                end

                require('telescope.builtin').live_grep({
                    prompt_title = "Live Grep in in (" .. cwd .. ")",
                    cwd = cwd,
                    mappings = {
                        i =  { ["<c-f>"] = require('telescope.actions').to_fuzzy_refine }, -- shortcut to fuzzy refine the search
                    },
                })
            end


            -- File Search
            vim.api.nvim_set_keymap('n', '<Leader>ff', ':Telescope find_files<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fz', ':lua _G.find_files_with_hidden()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fd', ':lua _G.search_directory_files()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>ftf', ':lua _G.search_nvim_tree_directory_files()<CR>', {noremap = true, silent = true})

            -- Buffer File Search / History Search
            vim.api.nvim_set_keymap('n', '<Leader>fb', ':Telescope buffers<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fh', ':lua _G.search_buffer_history()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fj', ':lua _G.search_jump_list()<CR>', {noremap = true, silent = true})

            -- Grep String / Code Fuzzy Search
            vim.api.nvim_set_keymap('n', '<Leader>fst', ':Telescope treesitter<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fsc', ':Telescope current_buffer_fuzzy_find<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fss', ':Telescope grep_string<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fsl', ':Telescope live_grep<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fsp', ':lua _G.prompt_and_search()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fsb', ':lua _G.live_grep_open_buffers()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>ftl', ':lua _G.live_grep_nvim_tree_directory_files()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fsd', ':lua _G.live_grep_current_directory_files()<CR>', {noremap = true, silent = true})

            -- Util Pickers
            vim.api.nvim_set_keymap('n', '<Leader>fm', ':Telescope marks<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fur', ':Telescope resume<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fup', ':Telescope pickers<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fuc', ':Telescope commands<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fut', ':Telescope help_tags<CR>', {noremap = true, silent = true})    -- list neovim help pages
            vim.api.nvim_set_keymap('n', '<Leader>fum', ':Telescope man_pages<CR>', {noremap = true, silent = true})

            -- LSP Search
            vim.api.nvim_set_keymap('n', '<Leader>gr', ':Telescope lsp_incoming_calls<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>gr', ':Telescope lsp_definitions<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>gi', ':Telescope lsp_implementations,<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>flc', ':Telescope lsp_incoming_calls<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>flr', ':Telescope lsp_references<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fld', ':Telescope lsp_definitions<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fli', ':Telescope lsp_implementations<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fld', ':Telescope diagnostics<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fls', ':Telescope lsp_document_symbols<CR>', {noremap = true, silent = true})

            -- Git Search
            vim.api.nvim_set_keymap('n', '<Leader>fgs', ':Telescope git_status<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fgc', ':Telescope git_commits<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fgb', ':Telescope git_bcommits<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fgv', ':Telescope git_bcommits_range<CR>', {noremap = true, silent = true})


            vim.notify({ "nvim-telescope has been configured" }, "INFO", {
              title = 'Plugin Ready | nvim-telescope',
              timeout = 2000,
            })

        end
    }
}
