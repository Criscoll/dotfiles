# Docs — Allowed Command Surface

All Docs operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.1 docs ...` directly. Every wrapper accepts `--help`.

Find a doc's ID with `drive-search "mimeType = 'application/vnd.google-apps.document' and name contains '...'"` (see drive.md). `--tab` always takes a tab **ID**, not a tab title; omit it for single-tab docs.

**Run doc edits one at a time, never in parallel.** Every edit shifts the indexes the next one relies on; two concurrent edits corrupted a doc (truncated block, duplicated block, mangled URL). Wait for each call to finish, and read back before the next.

## Reading

```bash
~/bin/agent_scripts/docs-read <doc-id>                 # Title:/Tab: header, "-" rule, text; truncated to 5000 chars
~/bin/agent_scripts/docs-read <doc-id> --full          # no truncation
~/bin/agent_scripts/docs-read <doc-id> --limit 20000
~/bin/agent_scripts/docs-read <doc-id> --markdown      # formatting visible: # headings, * / 1. lists, **bold**, links, tables

~/bin/agent_scripts/docs-find <doc-id> "some text"     # index=12 end_index=17 length=5 occurrences=1
~/bin/agent_scripts/docs-find <doc-id> "a" --occurrence 3
```

`docs-find` is **case-sensitive**, never finds text **inside tables**, and its indexes are off after any non-BMP character (emoji).

Plain `docs-read` hides all formatting; use `--markdown` to check headings, lists and links after a formatting edit. It exports the first tab only, its text does not map to character indexes, and its markdown tables do not show bold (a bold header row is still bold in the Doc).

## Creating

```bash
~/bin/agent_scripts/docs-create "Title" [--content "text" | --stdin] [--folder <folder-id>]
# Created: Title (id: <id>) <url>
```

## Editing text

Each prints a one-line result. Edits are live and there is no undo wrapper, so read first and use `docs-find` for fresh indexes.

```bash
# Add to the end (Appended N chars at index I)
~/bin/agent_scripts/docs-append <doc-id> "text"
echo "text" | ~/bin/agent_scripts/docs-append <doc-id> --stdin

# Insert plain text at a character index, or right after anchor text (case-sensitive)
~/bin/agent_scripts/docs-insert <doc-id> "text" --index 1               # default index 1 = start of body
~/bin/agent_scripts/docs-insert <doc-id> "X " --after-text "alpha" [--occurrence 2]

# Replace text. Default: ALL matches, case-insensitive. Prints the count; no preview is possible.
# Works inside tables too (the way to change existing cell text).
~/bin/agent_scripts/docs-replace <doc-id> "find" "replacement" [--match-case]
# Only the Nth match (requires --match-case; exits non-zero without it)
~/bin/agent_scripts/docs-replace <doc-id> "a" "A" --match-case --occurrence 2

# Replace a whole section: everything between two anchor lines, in ONE call (preferred for rewrites)
~/bin/agent_scripts/docs-replace-between <doc-id> "Planning" "Bookings" $'line one\nline two'
echo "$text" | ~/bin/agent_scripts/docs-replace-between <doc-id> "Planning" "Bookings" --stdin

# Swap a specific span (start end) for new text; --expect is the exact text currently there
~/bin/agent_scripts/docs-replace-range <doc-id> 9 13 "new text" --expect "old!"

# Delete a span; --expect is the exact text currently there
~/bin/agent_scripts/docs-delete-range <doc-id> 6 8 --expect "xy"

# Markdown at the end (default, on its own paragraph) or at --index N
~/bin/agent_scripts/docs-insert-markdown <doc-id> $'## Heading\n\n**bold** and *italic*\n\n- item'
~/bin/agent_scripts/docs-insert-markdown <doc-id> --file notes.md --index 1
```

Recommended edit flow for a span: `docs-read` → `docs-find` the target → `docs-replace-range` / `docs-delete-range` with those indexes and `--expect` → `docs-read` to confirm. For rewriting a section, use `docs-replace-between` instead and skip the index bookkeeping.

### `docs-replace-between`

Resolves the indexes itself, so nothing can go stale. The span runs from the line *after* the start-anchor line up to the start of the end-anchor line; both anchor lines stay. The end anchor is the first match after the start anchor and must start its line. The replacement is whole lines (a trailing newline is added if missing); an empty replacement clears the section. It prints the old text and the index span the new text now occupies, and resets the new lines to normal paragraphs with no bullets (inserted text would otherwise inherit the end anchor's heading style) — apply headings/bullets afterwards with the formatting wrappers using that span. It refuses (no change) when a table or emoji above the anchors makes the indexes unverifiable.

### Safety behavior

- `docs-replace-range` and `docs-delete-range` **require** `--expect TEXT` (or an explicit `--no-expect`). The script re-checks that the span still holds that text and aborts with no change otherwise, so a stale index fails instead of corrupting the doc. Text inside tables can't be verified, so spans there need `--no-expect`.
- Both also print the doc title, the index range and the text being removed *before* changing anything. That preview assumes a plain-text body (offset = index - 1), so around tables or emoji it can be wrong; a warning is printed when it can't be shown at all.
- `docs-replace` (all matches) can't preview; it prints how many occurrences changed.
- `docs-replace --occurrence N`, `docs-replace-range` and `docs-replace-between` are **not atomic**: they insert the new text at the end of the old span, then delete the old span (two API calls). If the delete fails the script says the doc is half-edited (new text inserted, old text still there) and exits non-zero.

### Index caveats

- Indexes are character positions in the doc; index 1 is the start of the body, end indexes are exclusive.
- They shift after every edit. **Re-run `docs-find` after any edit before reusing an index.**
- Doc indexes are UTF-16 code units; `docs-find` counts code points, so text after an emoji is off by one per emoji. Avoid index-based edits on emoji-heavy docs, or use `docs-replace` by text.

### `docs-insert-markdown`

The underlying insert keeps only **inline** styles (bold, italic, underline, strikethrough, links, colors, fonts) and strips the `#`/`-`/`1.` markers. The wrapper then reads the inserted text back, matches each line to its Markdown line, and applies heading styles (`#`..`######`) and lists (one bulleted or numbered list per run of adjacent items). It prints `Styled N headings and M lists`, or a `Warning: skipped heading/list styling` line if the lines couldn't be matched (code fences, tables, block quotes, rules, or a table above the insert point) — in that case only text and inline styles landed, so fix up with the formatting wrappers. Nested list levels are flattened. Styling is skipped with `--tab`.

With no `--index` it appends at the end, computed from the text `docs-read` returns; that can't see table structure, so the script refuses (exit 2) when the doc has tables and asks for an explicit `--index`.

## Formatting

These take the target as `--text TEXT [--occurrence N]` (the Nth case-sensitive match) or `--range START END` (end exclusive). Use `--range` with the span printed by `docs-replace-between`/`docs-insert`/`docs-append`. Check the result with `docs-read --markdown`.

```bash
# Heading level / alignment of the paragraph(s) containing the target
~/bin/agent_scripts/docs-format-paragraph <doc-id> --text "Guest List" --style h2     # normal|title|subtitle|h1..h6
~/bin/agent_scripts/docs-format-paragraph <doc-id> --range 10 40 --align center       # start|center|end|justified

# Bulleted / numbered list over the paragraphs in the target (ONE list per call), or remove it
~/bin/agent_scripts/docs-bullets <doc-id> --range 41 73 --kind bullet                 # bullet|numbered|none
~/bin/agent_scripts/docs-bullets <doc-id> --range 41 73 --kind numbered --preset NUMBERED_UPPERALPHA_ALPHA_ROMAN

# Character formatting; omitted flags are unchanged, --no-bold etc. turn a style off
~/bin/agent_scripts/docs-format <doc-id> --text "TBC" --bold --color '#CC0000'
~/bin/agent_scripts/docs-format <doc-id> --text "E-Proposal" --link https://example.com
~/bin/agent_scripts/docs-format <doc-id> --range 5 12 --italic --size 14 [--tab <tab-id>]
```

`docs-format-paragraph` and `docs-bullets` work on the first tab only; in `docs-format`, `--link` does not support `--tab`. To bullet a multi-line block, target from the first line's start to the last line's end: the range may end at a line's end, it won't spill into the next paragraph.

## Tables

Native Doc tables. Cells hold plain text (newlines allowed). First tab only. Each cell is a separate API call, so a table costs roughly 2 seconds per cell — keep tables modest and do not run them in parallel with other edits.

```bash
~/bin/agent_scripts/docs-table-insert <doc-id> --header --values '[["Venue","Min spend"],["Chiswick","TBC"],["Ducks",12000]]'
echo '[["a","b"]]' | ~/bin/agent_scripts/docs-table-insert <doc-id> --stdin
~/bin/agent_scripts/docs-table-insert <doc-id> --after-text "Quotes" --values '[...]'   # or --index N; default = end of doc
# Inserted 3x2 table #0 at index 83; filled 6 cells

~/bin/agent_scripts/docs-table-list <doc-id>             # "0 | 3x2 | index=83 end_index=140 | has content" (0-based numbers)
~/bin/agent_scripts/docs-table-fill <doc-id> 1 --values '[["a","b"]]' [--header]   # EMPTY existing table only
```

`--values` is a JSON array of rows; the table is sized to the longest row and short rows are padded. `--header` bolds the first row. The script verifies the table grew by exactly the text written and prints a `Warning:` otherwise.

- `docs-table-fill` fills from the top-left cell, may use a smaller grid than the table, and refuses a table that already has content (cell text can be added by index but not read or replaced that way). To change existing cell text, use `docs-replace` — it matches inside tables.
- `docs-find` and the index-span wrappers can't see inside tables, and `docs-replace-between` refuses when a table sits above its anchors. Do table-bearing edits last in a session, or work on the text above first.
- Inserting a table mid-paragraph (`--index`/`--after-text` pointing inside a line) splits that paragraph around it.

## Operations with no wrapper (do not attempt via raw gws-cli)

Docs tab create/delete/rename/reorder, table row/column insert/delete, cell merge, cell styling and column widths, images, page breaks, headers/footers, footnotes, named ranges, suggestions (accept/reject), page format, document style, line spacing/indents/borders/shading, nested list levels, and raw `batchUpdate`. There is also no delete/trash wrapper: scratch or mistaken docs must be deleted by the user.

If you need one of these, state what you need, confirm no existing wrapper covers it, then ask the user to add a new wrapper script — do not call gws-cli directly.
