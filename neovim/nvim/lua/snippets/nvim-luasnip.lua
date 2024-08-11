local ls = require("luasnip")
-- some shorthands...
local node = ls.snippet_node
local func = ls.function_node
local choice = ls.choice_node
local dynamicn = ls.dynamic_node

local s = ls.snippet
local t = ls.text_node
local i = ls.insert_node

local date = function() return {os.date('%Y-%m-%d')} end

ls.add_snippets(nil, {
    all = {
        s({
            trig = "date",
            namr = "Date",
            dscr = "Date in the form of YYYY-MM-DD",
        }, {
            func(date, {}),
        }),
    },
})

ls.add_snippets("markdown", {
    s({
        trig = ",task",  -- Trigger word
        name = "Task Template",  -- Name for the snippet
        dscr = "Insert frontmatter block with aliases, tags, and topics",  -- Description
    }, {
        t("---"),
        t({"", "aliases: "}),
        i(1, ""),  -- Placeholder for aliases
        t({"", "tags:"}),
        t({"", "  - \""}),
        i(2, "#Task/backlog"),  -- Default value for the first tag
        t({"\"", ""}),
        t({"topics:"}),
        t({"", "---"}),
        i(0),  -- Final cursor position
    }),
})
