return {
    {'nvim-treesitter/nvim-treesitter-textobjects'},
    {"nvim-treesitter/nvim-treesitter",
  event = { "BufReadPre", "BufNewFile" },
  build = ":TSUpdate",
  dependencies = {
    "windwp/nvim-ts-autotag",
    "nvim-treesitter/nvim-treesitter-textobjects",
  },
  config = function()
    -- import nvim-treesitter plugin
    local ts = require("nvim-treesitter.configs")
    require('nvim-ts-autotag').setup()

    -- configure treesitter
    ts.setup({ -- enable syntax highlighting
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
    })
  end,
    }
}
