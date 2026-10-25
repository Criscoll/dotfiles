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

## Reading back formatting and structure

```bash
~/bin/agent_scripts/sheets-inspect <id>                       # per-tab summary
~/bin/agent_scripts/sheets-inspect <id> --tab Sheet1          # one tab only
~/bin/agent_scripts/sheets-inspect <id> --format "Sheet1!A1:D6"      # cell formatting
~/bin/agent_scripts/sheets-inspect <id> --validation "Sheet1!B2:B6"  # data validation
~/bin/agent_scripts/sheets-inspect <id> --sizes --tab Sheet1         # widths / heights
```

Read-only. The summary lists, per tab: frozen rows/columns, the basic filter, filter views (`id | title | range`), merges, conditional-format rules with their **0-based index** (0 = highest priority), charts (`id | tab | type | title | anchor | WxH | N series`) and protected ranges. `--format` prints only cells that carry formatting, with identical neighbours grouped (`Data!A1:D1: bold, bg #DDDDDD`); it stops after 200 cells. `--sizes` prints runs of equal size (`A: 200px; B-Z: 100px`).

Use it to confirm every change below. The formatting wrappers also call it to show the "Before:" state.

**A1 ranges in all the wrappers below are 1-based and inclusive, with a mandatory tab** — `"Data!A1:D6"`, `"'My Tab'!B2"`, whole columns `"Data!A:C"`, whole rows `"Data!2:5"`, open-ended `"Data!A2:C"` (down to the last row). This is unlike `sheets-structure`, whose indexes are 0-based and end-exclusive. Colours are `#RGB` or `#RRGGBB`.

## Clearing values

```bash
~/bin/agent_scripts/sheets-clear <id> "Sheet1!A2:D6"
```

Prints `Before:` (the old content, formulas shown), then clears. **Values only** — formatting, validation, merges and filters stay. A range without a tab is refused (it would otherwise hit the first tab).

## Formatting

```bash
S=~/bin/agent_scripts/sheets-format
$S <id> style "Sheet1!A1:D1" --bold --bg "#DDDDDD" [--italic --underline --strikethrough] \
    [--font Arial --size 12 --fg "#FF0000" --h-align CENTER --v-align MIDDLE --wrap WRAP --number-format "0.00"]
$S <id> borders "Sheet1!A1:D6" --all [--top --bottom --left --right --inner-h --inner-v] \
    [--color "#000000" --style SOLID_MEDIUM --width 2]
$S <id> merge   "Sheet1!F1:G1" [--type MERGE_ALL|MERGE_COLUMNS|MERGE_ROWS]
$S <id> unmerge "Sheet1!F1:G1"
$S <id> col-width  "Sheet1!A:A" 200        # px, for the columns the range covers
$S <id> row-height "Sheet1!1:1" 40         # px, for the rows the range covers
$S <id> auto-resize "Sheet1!B:C"           # fit columns to content
$S <id> freeze --tab Sheet1 --rows 1 [--cols 1]   # 0 unfreezes
```

`--bold` / `--no-bold` (and italic, underline, strikethrough) turn a style on or off; flags you omit are left untouched. `style` needs at least one option and `borders` at least one side.

### Safety behavior

- Every op except `merge` prints `Before:` using `sheets-inspect` (formatting, sizes, or the tab summary) and aborts if that read fails.
- `merge` prints the cell values it will discard (everything except the top-left cell for `MERGE_ALL`) — merging destroys them and `unmerge` does not bring them back.

## Data validation

```bash
~/bin/agent_scripts/sheets-validation <id> set "Sheet1!B2:B6" --type ONE_OF_LIST --value Open --value Done
~/bin/agent_scripts/sheets-validation <id> set "Sheet1!C2:C6" --type NUMBER_BETWEEN --value 1 --value 10 [--allow-invalid] [--no-dropdown]
~/bin/agent_scripts/sheets-validation <id> clear "Sheet1!B2:B6"
```

`--type` is a gws-cli validation type (`ONE_OF_LIST`, `ONE_OF_RANGE`, `NUMBER_*`, `TEXT_*`, `DATE_*`, `CUSTOM_FORMULA`, `BOOLEAN`, ...; an unknown type makes the CLI list them). Give each dropdown option its own `--value`. Bad input is rejected unless `--allow-invalid`. Both ops print the existing validation first; read the result back with `sheets-inspect --validation`.

**Comma limitation:** gws-cli splits its value list on commas, so a `--value` or `--formula` containing a comma (an option like `a,b`, a formula like `=AND(A1>1,B1<2)`) is rejected by the wrapper.

## Filters

```bash
S=~/bin/agent_scripts/sheets-filter
$S <id> set "Sheet1!A1:D6"                 # the tab's basic filter (include the header row)
$S <id> clear --tab Sheet1
$S <id> view-create "Open only" "Sheet1!A1:D6"
$S <id> view-list                          # id | title | range
$S <id> view-delete <filter-view-id>
```

A tab has **one** basic filter: `set` replaces it (the current one is printed first, as is the tab summary before `clear`). These create the filter only — they set no criteria. `view-delete` prints the list first and refuses an id that is not in it.

## Conditional formatting

```bash
S=~/bin/agent_scripts/sheets-condformat
$S <id> add   "Sheet1!C2:C6" --condition NUMBER_GREATER --value 3 --bg "#FFCCCC" [--fg "#990000" --bold]
$S <id> scale "Sheet1!D2:D6" --min-color "#FFFFFF" --max-color "#00AA00" [--mid-color "#FFFF00"]
$S <id> clear --tab Sheet1
```

Conditions: `NUMBER_GREATER`, `NUMBER_GREATER_THAN_EQ`, `NUMBER_LESS`, `NUMBER_LESS_THAN_EQ`, `NUMBER_EQ`, `NUMBER_NOT_EQ`, `NUMBER_BETWEEN`, `NUMBER_NOT_BETWEEN`, `TEXT_CONTAINS`, `TEXT_NOT_CONTAINS`, `TEXT_STARTS_WITH`, `TEXT_ENDS_WITH`, `TEXT_EQ`, `BLANK`, `NOT_BLANK`, `CUSTOM_FORMULA`. `add` needs at least one of `--bg` / `--fg` / `--bold`.

- A new rule is inserted at **index 0 = highest priority**; existing rules shift down. `sheets-inspect --tab T` lists the rules with their indexes.
- **`clear` removes ALL rules on the tab** — there is no per-rule delete. It prints the rules first.
- Same comma limitation as validation (a `CUSTOM_FORMULA` with commas cannot be passed).

## Charts

Note the order here: the op comes **before** the spreadsheet id.

```bash
S=~/bin/agent_scripts/sheets-chart
$S add <id> --tab Sheet1 --type COLUMN --domain "Sheet1!A1:A6" \
    --series "Sheet1!C1:C6" --series "Sheet1!D1:D6" --headers --title "Qty and price" \
    [--anchor F2] [--width 600] [--height 400]
$S list <id> [--tab Sheet1]
$S delete <id> <chart-id>
```

Types: `BAR` (horizontal), `COLUMN`, `LINE`, `AREA`, `SCATTER`, `PIE` (exactly one `--series`). Each `--domain` / `--series` range is a single column, series may be non-adjacent columns, and every range must cover the same rows. With `--headers` each range's first row is its header (series name); a `PIE` has no header notion, so that row is dropped. `--tab` is where the chart sits; `--anchor` is its top-left cell (default: row 1, one column right of the source data).

There is no chart update — `delete` it and `add` it again. `delete` prints the chart first and refuses an id that is not a chart in the spreadsheet.

## Operations with no wrapper (do not attempt via raw gws-cli)

Pivots, protected ranges, named ranges, banding, copy-paste, auto-fill, move rows/columns, `duplicate-sheet`, text-to-columns, trim-whitespace, `batch-get`, raw `batchUpdate`, and updating a chart in place (delete and re-add instead). Spreadsheets can be trashed and restored with `drive-trash` / `drive-restore` (see drive.md); permanent deletion is the user's job.

If you need one of these, state what you need, confirm no existing wrapper covers it, then ask the user to add a new wrapper script — do not call gws-cli directly.
