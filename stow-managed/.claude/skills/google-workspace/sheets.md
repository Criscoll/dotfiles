# Sheets — Allowed Command Surface

All Sheets operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.1 sheets ...` directly. Every wrapper accepts `--help`.

Find a spreadsheet's ID with `drive-search "mimeType = 'application/vnd.google-apps.spreadsheet' and name contains '...'"` (see drive.md). Ranges are A1 notation, e.g. `Sheet1!A1:C10`; quote tab names with spaces: `"'My Tab'!A1:B2"`.

## Reading

```bash
~/bin/agent_scripts/sheets-tabs <spreadsheet-id>
# Spreadsheet: <title>
# <sheet_id> | <tab title> | <rows> x <cols>     (one line per tab)

~/bin/agent_scripts/sheets-read <spreadsheet-id> "Sheet1!A1:C10"
# Sheet1!A1:C10 | 3 rows      <- header line, then tab-separated rows
~/bin/agent_scripts/sheets-read <spreadsheet-id> "Sheet1!A1:C10" --formulas   # show =formulas, not values
```

Cells containing tabs/newlines are printed with `\t` / `\n` so each row stays one line. Trailing empty cells and rows are omitted by the API.

## Creating

```bash
~/bin/agent_scripts/sheets-create "Title" [--sheets "Data,Notes"] [--folder <folder-id>]
# Created: Title (id: <id>) <url>
```

## Writing

Values are a JSON array of rows. Input is parsed as if typed in (formulas work: `"=SUM(A1:A3)"`).

```bash
# Overwrite a range. Prints "Before:" (the old content, formulas shown) and then "Wrote N cells".
~/bin/agent_scripts/sheets-write <id> "Sheet1!A1:B2" --values '[["a","b"],[1,2]]'
echo '[["x"]]' | ~/bin/agent_scripts/sheets-write <id> "Sheet1!D1" --stdin

# Append rows after the last row of the table at that tab/range (inserts, never overwrites)
~/bin/agent_scripts/sheets-append <id> Sheet1 --values '[["x","y"]]'

# Find & replace: one tab by title or every tab (default). Case-insensitive unless --match-case.
~/bin/agent_scripts/sheets-find-replace <id> "old" "new" --tab Sheet1 [--match-case] [--entire-cell] [--regex]
~/bin/agent_scripts/sheets-find-replace <id> "old" "new" --all-tabs
```

`sheets-find-replace` can't preview; it prints `occurrences/values/sheets` changed counts. Prefer `--tab` and `--entire-cell`, and `sheets-read` to confirm.

## Structure

```bash
~/bin/agent_scripts/sheets-structure <id> insert-rows    --tab Sheet1 <start> <count>
~/bin/agent_scripts/sheets-structure <id> insert-columns --tab Sheet1 <start> <count>
~/bin/agent_scripts/sheets-structure <id> delete-rows    --tab Sheet1 <start> <end>
~/bin/agent_scripts/sheets-structure <id> delete-columns --tab Sheet1 <start> <end>
~/bin/agent_scripts/sheets-structure <id> sort --tab Sheet1 <start_row> <end_row> <start_col> <end_col> <sort_col> [--desc]
~/bin/agent_scripts/sheets-structure <id> add-tab "New Tab"
~/bin/agent_scripts/sheets-structure <id> rename-tab --tab "Old" "New"
~/bin/agent_scripts/sheets-structure <id> delete-tab --tab "Old"
```

Tabs are chosen by **title** (`--tab`), which the wrapper resolves to the numeric sheet id; an unknown title exits non-zero and lists the real titles. Never pass the numeric id as the tab.

### Safety behavior

- `sheets-write` reads the target range first and prints `Before:` (or `Before: (empty)`) — read the output to confirm you overwrote what you meant to.
- `delete-rows` / `delete-columns` print the affected cells (`Before (cells being removed)`) before deleting.
- `delete-tab` prints the tab's title, `rows x cols` and its first 5 rows before deleting.

### Index caveats

- Row and column indexes in `sheets-structure` are **0-based and end-exclusive**: `delete-rows --tab T 0 1` removes A1-notation row 1 only; `delete-columns --tab T 1 3` removes columns B and C.
- Inserting at index 0 is rejected by the API via gws-cli (`inheritFromBefore`); insert at index 1 or later.
- `sort` bounds are a rectangle (`start_row..end_row`, `start_col..end_col`, end-exclusive); `sort_col` is an absolute 0-based column index inside it. To keep a header row in place, start at row 1.
- A1 ranges in `sheets-read` / `sheets-write` are 1-based and inclusive, as in the Sheets UI.

## Operations with no wrapper (do not attempt via raw gws-cli)

`clear` (values clear), cell and extended formatting, borders, merges/unmerges, column widths/row heights, freeze rows/columns, conditional formats and color scales, data validation, charts, pivots, protected ranges, named ranges, basic filters and filter views, banding, copy-paste, auto-fill, move rows/columns, `duplicate-sheet`, text-to-columns, trim-whitespace, `batch-get`, and raw `batchUpdate`. There is also no delete/trash wrapper for spreadsheets: scratch or mistaken files must be deleted by the user.

If you need one of these, state what you need, confirm no existing wrapper covers it, then ask the user to add a new wrapper script — do not call gws-cli directly.
