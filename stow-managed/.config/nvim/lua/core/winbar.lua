local M = {}

function M.get()
  local path = vim.fn.expand('%:p')
  if path == '' then return '' end

  local cwd = vim.fn.getcwd()
  if path:sub(1, #cwd) == cwd then
    path = path:sub(#cwd + 2)
  end

  local parts = vim.split(path, '/', { plain = true })
  parts = vim.tbl_filter(function(p) return p ~= '' end, parts)
  return table.concat(parts, ' > ')
end

vim.opt.winbar = "%{%v:lua.require('core.winbar').get()%}"

return M
