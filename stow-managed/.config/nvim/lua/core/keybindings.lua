vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

vim.opt.syntax = "true"
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.clipboard = "unnamedplus"

-- vim.api.nvim_set_keymap('i', '<S-Tab>', "<Esc>:tabprevious<CR>i", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<CR>', ":noh<CR>", {noremap = true, silent = true})

-- Unindent line in normal mode
vim.api.nvim_set_keymap('n', '<S-Tab>', '<<', { noremap = true, silent = true })

-- Unindent line in insert mode
vim.api.nvim_set_keymap('i', '<S-Tab>', '<C-o><<', { noremap = true, silent = true })

-- Unindent selected lines in visual mode
vim.api.nvim_set_keymap('v', '<S-Tab>', '<<', { noremap = true, silent = true })

-- Define :SaveSession command
vim.api.nvim_create_user_command('SaveSession', function()
  vim.cmd('mksession! ~/.config/nvim/session.vim')
end, {})

-- Define :RestoreSession command
vim.api.nvim_create_user_command('RestoreSession', function()
  vim.cmd('source ~/.config/nvim/session.vim')
end, {})

vim.api.nvim_create_user_command('PWD', function()
  vim.cmd('!echo %')
end, {})

-- Define :ClearMarks command
vim.api.nvim_create_user_command('ClearMarks', function()
  vim.cmd(':delm! | delm A-Z0-9')
end, {})

-- Define Clear Buffers Command
vim.api.nvim_create_user_command('ClearBufferList', function()
    vim.cmd("bufdo bdelete")
end, {})

-- Define Reload from Disk Command
vim.api.nvim_create_user_command('ReloadFromDisk', function()
    vim.cmd("bufdo e!")
end, {})

function ToggleCheckbox()
    local line = vim.fn.line('.')
    local text = vim.fn.getline(line)

    -- Check if the line starts with '- [ ]' or '- [X]'
    if string.match(text, "^%s*%-%s%[%s*%]") or string.match(text, "^%s*%-%s%[%s*X%s*%]") then
        -- Toggle between '[ ]' and '[X]'
        if string.match(text, "%[%s*%]") then
            text = string.gsub(text, "%[%s*%]", "[X]")
        elseif string.match(text, "%[%s*X%s*%]") then
            text = string.gsub(text, "%[%s*X%s*%]", "[ ]")
        end
    else
        -- Prepend '- [ ]' if it doesn't start with a checkbox
        text = "- [ ] " .. text
    end

    -- Set the modified line
    vim.fn.setline(line, text)
end

function ToggleStrikethrough()
    local line = vim.fn.line('.')
    local text = vim.fn.getline(line)

    -- Check if the line starts with a checkbox pattern
    local checkbox_pattern = "^(%s*%-%s%[%s*[X%s]*%s*%]%s*)"
    local checkbox_prefix = string.match(text, checkbox_pattern)

    if checkbox_prefix then
        -- Extract the text after the checkbox
        local content = string.sub(text, string.len(checkbox_prefix) + 1)

        -- Toggle strikethrough on the content only
        if string.match(content, "^~.*~$") then
            -- Remove strikethrough
            content = string.gsub(content, "^~(.*)~$", "%1")
        else
            -- Add strikethrough
            content = "~" .. content .. "~"
        end

        -- Reconstruct the line
        text = checkbox_prefix .. content
    else
        -- No checkbox, toggle strikethrough on entire line
        if string.match(text, "^~.*~$") then
            -- Remove strikethrough
            text = string.gsub(text, "^~(.*)~$", "%1")
        else
            -- Add strikethrough
            text = "~" .. text .. "~"
        end
    end

    -- Set the modified line
    vim.fn.setline(line, text)
end

-- Keybinding for toggling checkbox
vim.api.nvim_set_keymap('n', '<leader>c', [[:lua ToggleCheckbox()<CR>]], { noremap = true, silent = true })

-- Keybinding for toggling strikethrough
vim.api.nvim_set_keymap('n', '<leader>s', [[:lua ToggleStrikethrough()<CR>]], { noremap = true, silent = true })


vim.api.nvim_create_user_command('ReloadConfig', function()
    vim.cmd("source ~/.config/nvim/init.lua")
end, {})

-- Command to disable diagnostics globally
vim.api.nvim_create_user_command(
    'DisableDiagnostics',
    function() vim.diagnostic.disable() end,
    {}
)

-- Command to enable diagnostics globally
vim.api.nvim_create_user_command(
    'EnableDiagnostics',
    function() vim.diagnostic.enable() end,
    {}
)

-- Command to disable diagnostics for the current buffer
vim.api.nvim_create_user_command(
    'DisableBufferDiagnostics',
    function() vim.diagnostic.disable(0) end,
    {}
)

-- Command to enable diagnostics for the current buffer
vim.api.nvim_create_user_command(
    'EnableBufferDiagnostics',
    function() vim.diagnostic.enable(0) end,
    {}
)

-- Split Tab
vim.api.nvim_set_keymap('n', '<C-w>z', ':tab split<CR>', { noremap = true, silent = true })


-- Example usage:
-- :ReplaceBelow foo bar
-- This will replace all occurrences of "foo" with "bar" from the current line downward.
vim.api.nvim_create_user_command(
  'ReplaceBelow',
  function(opts)
    if #opts.fargs ~= 2 then
      vim.api.nvim_err_writeln("ReplaceBelow requires exactly two arguments: <search> <replace>")
      return
    end

    vim.cmd('.,$s/' .. opts.fargs[1] .. '/' .. opts.fargs[2] .. '/g')
  end,
  { nargs = '*' }
)


