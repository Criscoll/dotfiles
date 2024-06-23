return {
       "hrsh7th/nvim-cmp",
    dependencies = {
        'hrsh7th/cmp-nvim-lsp',
        'hrsh7th/cmp-buffer',
        'hrsh7th/cmp-path',
        'hrsh7th/cmp-cmdline',
        'L3MON4D3/LuaSnip',         -- snippet engine
        'saadparwaiz1/cmp_luasnip',
        'lukas-reineke/cmp-rg',     -- ripgrep cmp source. Provides project wide text completions
    },
    config = function() local cmp = require('cmp')
        local luasnip = require('luasnip')

        local kind_icons = {       -- icons for formatting the completion menu
          Text = "",
          Method = "󰆧",
          Function = "󰊕",
          Constructor = "",
          Field = "󰇽",
          Variable = "󰂡",
          Class = "󰠱", Interface = "", Module = "", Property = "󰜢",
          Unit = "",
          Value = "󰎠",
          Enum = "",
          Keyword = "󰌋",
          Snippet = "",
          Color = "󰏘",
          File = "󰈙",
          Reference = "",
          Folder = "󰉋",
          EnumMember = "",
          Constant = "󰏿",
          Struct = "",
          Event = "",
          Operator = "󰆕",
          TypeParameter = "󰅲",
        }

        cmp.setup({
            completion = {
                autocomplete = false,       -- disables autocomplete in favour of invoking completion manually
            },
            snippet = {
                expand = function(args)
                    luasnip.lsp_expand(args.body) -- For `luasnip` users.
                end,
            },
            mapping = {
                ['<C-e>'] = cmp.mapping.complete(),                  -- Manually invoke completion menu
                ['<C-c>'] = cmp.mapping.close(),                     -- Close the completion menu
                ['<C-b>'] = cmp.mapping.scroll_docs(-4),
                ['<C-f>'] = cmp.mapping.scroll_docs(4),
                ['<Tab>'] = cmp.mapping(function(fallback)           -- Cycle forwards in the completion menu if cmp.visible() then cmp.select_next_item() elseif luasnip.expand_or_jumpable() then luasnip.expand_or_jump()
                    if cmp.visible() then
                        cmp.select_next_item()
                    elseif luasnip.jumpable(1) then
                        luasnip.jump(1)
                    else
                        fallback()
                    end
                end, { 'i', 's' }),
                ['<S-Tab>'] = cmp.mapping(function(fallback)         -- Cycle backwards in the completion menu
                    if cmp.visible() then
                        cmp.select_prev_item()
                    elseif luasnip.jumpable(-1) then
                        luasnip.jump(-1)
                    else
                        fallback()
                    end
                end, { 'i', 's' }),
                ['<CR>'] = cmp.mapping(function (fallback)          -- Accept currently selected item. (Carriage return / enter)
                    if cmp.visible() and cmp.get_selected_entry() then      -- this is needed to prevent selecting the first option whenever I hit enter, even if its no highlighted
                        cmp.confirm({ select = true})
                    else
                        fallback()
                    end
                end
                ),
            },
            sources = cmp.config.sources({                          -- defines sources and their priority
                { name = 'nvim_lsp' },
                { name = 'luasnip' },
                { name = 'buffer' },
            }, {
                { name = "rg" , keyword_length = 3},                -- rg has lower priority over buffer
                { name = 'path' },
            }),
            formatting = {
                format = function(entry, vim_item)                  -- formats the completion menu
                  -- Kind icons
                  vim_item.kind = string.format('%s %s', kind_icons[vim_item.kind], vim_item.kind) -- This concatenates the icons with the name of the item kind
                  -- Source
                  vim_item.menu = ({
                    buffer = "[Buffer]",
                    nvim_lsp = "[LSP]",
                    luasnip = "[LuaSnip]",
                    nvim_lua = "[Lua]",
                    latex_symbols = "[LaTeX]",
                    rg = "[RG]",
                  })[entry.source.name]
                  return vim_item
                end,
            }
        })

        -- Use buffer source for `/` (if you enabled `native_menu`, this won't work anymore).
        cmp.setup.cmdline('/', {
            mapping = {
                ['<Tab>'] = cmp.mapping(cmp.mapping.select_next_item(), { 'c' }),
                ['<S-Tab>'] = cmp.mapping(cmp.mapping.select_prev_item(), { 'c' }),
                ['<C-e>'] = cmp.mapping.close(),
                ['<CR>'] = cmp.mapping.confirm({ select = true }),
            },
            sources = {
                { name = 'buffer' }
            }
        })

        -- Use cmdline & path source for ':' (if you enabled `native_menu`, this won't work anymore).
        cmp.setup.cmdline(':', {
            mapping = {
                ['<Tab>'] = cmp.mapping(cmp.mapping.select_next_item(), { 'c' }),
                ['<S-Tab>'] = cmp.mapping(cmp.mapping.select_prev_item(), { 'c' }),
                ['<C-e>'] = cmp.mapping.close(),
                ['<CR>'] = cmp.mapping.confirm({ select = true }),
            },
            sources = cmp.config.sources({
                { name = 'path' }
            }, {
                { name = 'cmdline' }
            })
        })
    end

}

