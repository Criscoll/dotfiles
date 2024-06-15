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
            local notify = require('notify')

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
                        find_command = { 'rg', '--files'}
                    },
                    live_grep = {
                        grep_command = 'rg',
                        grep_args = { '--color=always', '--with-filename', '--line-number', '--column', '--no-ignore'},
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
                  prompt_title = "Find String (Manual)",
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
                    path_display = { "truncate" },
                }
                require('telescope.builtin').buffers(require('telescope.themes').get_cursor(stackOptions))
            end

            vim.api.nvim_set_keymap('n', '<Leader>fh', ':lua _G.search_buffer_history()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fl', ':lua _G.prompt_and_search()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fu', ':lua _G.find_files_with_hidden()<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>ff', ':Telescope find_files<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fb', ':Telescope buffers<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fg', ':Telescope live_grep<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fs', ':Telescope grep_string<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fc', ':Telescope current_buffer_fuzzy_find<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fr', ':Telescope lsp_references<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fd', ':Telescope lsp_definitions<CR>', {noremap = true, silent = true})
            vim.api.nvim_set_keymap('n', '<Leader>fi', ':Telescope lsp_implementations<CR>', {noremap = true, silent = true})
            -- vim.keymap.set("n", "<leader>fe", function() builtin.find_files({ cwd = utils.buffer_dir() }) end, {desc = "Find files in buffer dir"})
            notify({ "nvim-telescope has been configured" }, "INFO", {
              title = 'Plugin Ready | nvim-telescope',
              timeout = 2000,
            })

        end
    }
}
