local function define_formatters()
    vim.api.nvim_create_user_command('FormatLua', function()
        vim.cmd('silent !stylua %')
        vim.cmd('edit!')
    end, {})

    vim.api.nvim_create_user_command('FormatPython', function()
        vim.cmd('silent !black %')
        vim.cmd('edit!')
    end, {})
end

define_formatters()
