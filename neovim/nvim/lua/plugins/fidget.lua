return {
   'j-hui/fidget.nvim',
    config = function()
        require("fidget").setup({
            progress = {
                suppress_on_insert = false,
                ignore_empty_message = false,
                ignore = {},                -- List of LSP servers to ignore

                display = {
                    render_limit = 16,          -- How many LSP messages to show at once
                    done_ttl = 3,               -- How long a message should persist after completion
                    done_icon = "✔",            -- Icon shown when all LSP progress tasks are complete
                    progress_icon =             -- Icon shown when LSP progress tasks are in progress
                        { pattern = "dots", period = 1 },
                    progress_style =            -- Highlight group for in-progress LSP tasks
                        "WarningMsg",
                },
            },

            notification = {
                filter = vim.log.levels.INFO, -- Minimum notifications level
                view = {
                    stack_upwards = true,       -- Display notification items from bottom to top
                },
            },


        })
    end
}
