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
        t({"", "- "}),
        i(1, ""),  -- Placeholder for aliases
        t({"", "topics:"}),
        t({"", "---"}),
        t({"", ""}),
        t({"", ""}),
        t({"", "# Recursive Outline"}),
        t({"", ""}),
        i(0),  -- Final cursor position
    }),
})

ls.add_snippets("html", {
    s({
        trig = "html",  -- Trigger for the snippet
        name = "HTML Template",  -- Name of the snippet
        dscr = "Basic HTML5 template with head and body",  -- Description of the snippet
    }, {
        t({
            "<!DOCTYPE html>",
            "<html lang=\"en\">",
            "    <head>",
            "        <meta charset=\"UTF-8\">",
            "        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
            "        <meta http-equiv=\"X-UA-Compatible\" content=\"ie=edge\">",
            "        <title>"
        }),
        i(1, "Document Title"),  -- Placeholder for the document title
        t({
            "</title>",
            "    </head>",
            "    <body>",
            "        "
        }),
        i(2, "<!-- Content goes here -->"),  -- Placeholder for main content
        t({
            "",
            "    </body>",
            "</html>"
        }),
        i(0),  -- Final cursor position
    }),
})
