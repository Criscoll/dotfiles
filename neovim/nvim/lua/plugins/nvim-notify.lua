return {
  'rcarriga/nvim-notify',
  priority = 1000,
  config = function()
    local notify = require("notify")

    notify.setup({
        render = "wrapped-compact",
        stages = "static",
        timeout = 2000,
        background_colour = "#2E3440",
        minimum_width = 50, max_width = 60,
        wrap = true,
        icons = {
          ERROR = "",
          WARN = "",
          INFO = "",
          DEBUG = "",
          TRACE = "✎",
        },
        level = vim.log.levels.DEBUG
    })

    vim.notify = notify
        --
    -- Intercept LSP log messages
    vim.lsp.handlers["window/logMessage"] = function(_, result, ctx)
      local client = vim.lsp.get_client_by_id(ctx.client_id)
      if not client then
        notify("Client not found", "ERROR", { title = "nvim-notify" })
        return
      end

      local lvl = ({
        [1] = 'ERROR',
        [2] = 'WARN',
        [3] = 'INFO',
        [4] = 'DEBUG',
      })[result.type]

      if lvl == 1 then
          notify(result.message, lvl, {
            title = 'LSP Log | ' .. client.name,
            timeout = 500,
          })
      elseif lvl == 2 then
          notify(result.message, lvl, {
            title = 'LSP Log | ' .. client.name,
            timeout = 3000,
          })
      end
    end

    -- Intercept LSP showMessage
    vim.lsp.handlers['window/showMessage'] = function(_, result, ctx)
      local client = vim.lsp.get_client_by_id(ctx.client_id)
      local lvl = ({
        'ERROR',
        'WARN',
        'INFO',
        'DEBUG',
      })[result.type]
      notify({ result.message }, lvl, {
        title = 'LSP | ' .. client.name,
        timeout = 2000,
      })
    end


    local function clear_notifications()
        notify.dismiss({ silent = true, pending = true })
    end

    vim.api.nvim_create_user_command('ClearNotifications', clear_notifications, {}) -- make command to clear notifications

  end
}

