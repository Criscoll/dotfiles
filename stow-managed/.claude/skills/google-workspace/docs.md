# Docs — Allowed Command Surface

All Docs operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.1 docs ...` directly. Every wrapper accepts `--help`.

Find a doc's ID with `drive-search "mimeType = 'application/vnd.google-apps.document' and name contains '...'"` (see drive.md). `--tab` always takes a tab **ID**, not a tab title; omit it for single-tab docs.

## Reading

```bash
~/bin/agent_scripts/docs-read <doc-id>                 # Title:/Tab: header, "-" rule, text; truncated to 5000 chars
~/bin/agent_scripts/docs-read <doc-id> --full          # no truncation
~/bin/agent_scripts/docs-read <doc-id> --limit 20000

~/bin/agent_scripts/docs-find <doc-id> "some text"     # index=12 end_index=17 length=5 occurrences=1
~/bin/agent_scripts/docs-find <doc-id> "a" --occurrence 3
```

`docs-find` is **case-sensitive**, never finds text **inside tables**, and its indexes are off after any non-BMP character (emoji).

## Creating

```bash
~/bin/agent_scripts/docs-create "Title" [--content "text" | --stdin] [--folder <folder-id>]
# Created: Title (id: <id>) <url>
```

## Editing

Each prints a one-line result. Edits are live and there is no undo wrapper, so read first and use `docs-find` for fresh indexes.

```bash
# Add to the end (Appended N chars at index I)
~/bin/agent_scripts/docs-append <doc-id> "text"
echo "text" | ~/bin/agent_scripts/docs-append <doc-id> --stdin

# Insert plain text at a character index, or right after anchor text (case-sensitive)
~/bin/agent_scripts/docs-insert <doc-id> "text" --index 1               # default index 1 = start of body
~/bin/agent_scripts/docs-insert <doc-id> "X " --after-text "alpha" [--occurrence 2]

# Replace text. Default: ALL matches, case-insensitive. Prints the count; no preview is possible.
~/bin/agent_scripts/docs-replace <doc-id> "find" "replacement" [--match-case]
# Only the Nth match (requires --match-case; exits non-zero without it)
~/bin/agent_scripts/docs-replace <doc-id> "a" "A" --match-case --occurrence 2

# Swap a specific span (start end) for new text; prints the title, range and old text first
~/bin/agent_scripts/docs-replace-range <doc-id> 9 13 "new text"

# Delete a span; prints the title, range and the doomed text first
~/bin/agent_scripts/docs-delete-range <doc-id> 6 8

# Markdown at the end (default, on its own paragraph) or at --index N
~/bin/agent_scripts/docs-insert-markdown <doc-id> $'**bold** and *italic*'
~/bin/agent_scripts/docs-insert-markdown <doc-id> --file notes.md --index 1
```

Recommended edit flow: `docs-read` → `docs-find` the target → `docs-replace-range` / `docs-delete-range` with those indexes → `docs-read` to confirm.

### Safety behavior

- `docs-replace-range` and `docs-delete-range` print the doc title, the index range and the text being removed *before* changing anything. The text preview assumes a plain-text body (offset = index - 1), so around tables or emoji it can be wrong; a warning is printed when it can't be shown at all.
- `docs-replace` (all matches) can't preview; it prints how many occurrences changed.
- `docs-replace --occurrence N` and `docs-replace-range` are **not atomic**: they insert the new text at the end of the old span, then delete the old span (two API calls). If the delete fails the script says the doc is half-edited (new text inserted, old text still there) and exits non-zero.

### Index caveats

- Indexes are character positions in the doc; index 1 is the start of the body, end indexes are exclusive.
- They shift after every edit. **Re-run `docs-find` after any edit before reusing an index.**
- Doc indexes are UTF-16 code units; `docs-find` counts code points, so text after an emoji is off by one per emoji. Avoid index-based edits on emoji-heavy docs, or use `docs-replace` by text.

### `docs-insert-markdown` limits

gws-cli renders the Markdown through a temporary Drive doc and copies over **inline** styles only (bold, italic, underline, strikethrough, links, colors, fonts). Paragraph styles are dropped: `# Heading` arrives as plain text, and `- item` lines as plain lines. The `--at-end` index is computed from the text `docs-read` returns, so for docs ending in a table pass `--index` explicitly.

## Operations with no wrapper (do not attempt via raw gws-cli)

Docs tab create/delete/rename/reorder, text and paragraph formatting, tables (insert/rows/columns/merge/style), images, page breaks, headers/footers, footnotes, named ranges, suggestions (accept/reject), page format, document style, bullets/lists, `export`, and raw `batchUpdate`. There is also no delete/trash wrapper: scratch or mistaken docs must be deleted by the user.

If you need one of these, state what you need, confirm no existing wrapper covers it, then ask the user to add a new wrapper script — do not call gws-cli directly.
