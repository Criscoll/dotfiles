return {
    {'nvim-treesitter/nvim-treesitter-textobjects'},
    {"nvim-treesitter/nvim-treesitter",
  event = { "BufReadPre", "BufNewFile" },
  build = ":TSUpdate",
  dependencies = {
    "nvim-treesitter/nvim-treesitter-textobjects",
  },
  config = function()
    -- configure treesitter
    require('nvim-treesitter.configs').setup({ -- enable syntax highlighting
      highlight = {
        enable = true,
      },
      -- enable indentation
      indent = { enable = true },
      -- ensure these language parsers are installed
      ensure_installed = {
        "json",
        "javascript",
        "typescript",
        "tsx",
        "yaml",
        "html",
        "css",
        "markdown",
        "markdown_inline",
        "svelte",
        "bash",
        "lua",
        "vim",
        "dockerfile",
        "gitignore",
        "query",
        "vimdoc",
        "c",
        "cpp",
        "java",
        "scala",
        "python",
      },

      sync_install = false,
      incremental_selection = {
        enable = true,
        keymaps = {
          init_selection = "<C-space>",
          node_incremental = "<C-space>",
          scope_incremental = false,
          node_decremental = "<bs>",
        },
      },
      textobjects = {
            move = {
              enable = true,
              set_jumps = true, -- Whether to set jumps in the jumplist
              goto_next_start = {
                ["]n"] = "@function.outer",
                ["<C-n>"] = "@function.outer",
              },
              goto_previous_start = {
                ["[n"] = "@function.outer",
                ["<C-m>"] = "@function.outer",
              },
            },
      },
        autotag = {
            enable = true,
        }
    })
  end,
    },
    {
        'windwp/nvim-ts-autotag',
        dependencies = {
            "nvim-treesitter/nvim-treesitter"
        },
      config = function ()
        require('nvim-ts-autotag').setup({})
      end,
      lazy = true,
      event = "VeryLazy"
    },
}
