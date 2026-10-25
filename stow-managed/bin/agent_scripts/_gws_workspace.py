"""Shared helpers for the docs-* and sheets-* gws-cli wrappers.

Imported (not executed) by the wrapper scripts via
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))). The only I/O is
the gws-cli subprocess call, plus a scratch temp dir for `docs export`.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

GWS = ["uvx", "gws-cli@1.3.1"]


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def die(msg, code=1):
    eprint(msg)
    sys.exit(code)


class GwsError(Exception):
    def __init__(self, msg, code=1):
        super().__init__(msg)
        self.code = code


def try_gws(sub_args, stdin=None):
    """Run `gws-cli <sub_args>`; return the parsed success payload or raise GwsError."""
    result = subprocess.run(GWS + sub_args, check=False, capture_output=True, text=True, input=stdin)
    if result.returncode != 0:
        msg = result.stderr.strip()
        if result.stdout:
            try:
                err = json.loads(result.stdout)
                msg = err.get("message", msg) or msg
            except json.JSONDecodeError:
                pass
        raise GwsError(msg or "gws-cli failed", result.returncode)

    try:
        outer = json.loads(result.stdout)
    except json.JSONDecodeError:
        raise GwsError(f"Unexpected non-JSON output:\n{result.stdout}") from None

    if isinstance(outer, dict) and outer.get("status") == "error":
        raise GwsError(outer.get("message", "Unknown error"))
    return outer


def run_gws(sub_args, stdin=None):
    """Like try_gws, but print the error to stderr and exit instead of raising."""
    try:
        return try_gws(sub_args, stdin)
    except GwsError as e:
        die(str(e), e.code)


def extract(value):
    """Unwrap the {"data": ...} envelope that appears when security_enabled is on."""
    if isinstance(value, dict) and "data" in value:
        return value["data"]
    return value


def json_field(outer, key):
    """Decode a field that gws-cli returns as a JSON-encoded string."""
    value = extract(outer.get(key, "null"))
    return json.loads(value) if isinstance(value, str) else value


def doc_read(doc_id, tab=None):
    """Return (title, tab_id, content) for a Doc."""
    args = ["docs", "read", doc_id]
    if tab:
        args += ["--tab", tab]
    outer = run_gws(args)
    return (
        extract(outer.get("title", "")),
        outer.get("tab_id") or "",
        extract(outer.get("content", "")) or "",
    )


def doc_find(doc_id, text, tab=None, occurrence=1):
    """Locate the Nth case-sensitive match of `text`; return the find-text payload."""
    args = ["docs", "find-text", doc_id, "--occurrence", str(occurrence)]
    if tab:
        args += ["--tab", tab]
    return run_gws(args + ["--", text])


def doc_read_markdown(doc_id):
    """Return the Doc exported as Markdown (shows headings, lists, bold, links, tables).

    `docs export` can only write to a file, so it goes through a fresh temp dir.
    It has no --tab option: multi-tab docs export the first tab.
    """
    with tempfile.TemporaryDirectory() as scratch:
        path = os.path.join(scratch, "export.md")
        run_gws(["docs", "export", doc_id, path, "--format", "markdown"])
        with open(path, encoding="utf-8") as f:
            return f.read()


def utf16_len(text):
    """Length in Doc index units (UTF-16 code units), unlike len() for emoji."""
    return len(text.encode("utf-16-le")) // 2


def utf16_slice(text, start, length):
    """`length` Doc index units of `text` starting at unit offset `start` (emoji count as 2)."""
    out, pos = [], 0
    for ch in text:
        if pos >= start + length:
            break
        if pos >= start:
            out.append(ch)
        pos += 2 if ord(ch) > 0xFFFF else 1
    return "".join(out)


def list_tables(doc_id):
    """Return the Doc's tables in document order: dicts with startIndex/endIndex/rows/columns.

    gws-cli's table commands have no --tab option, so this covers the first tab.
    """
    return run_gws(["docs", "list-tables", doc_id]).get("tables") or []


def table_is_empty(table):
    """True when every cell is empty (span == table + rows + cells' bare paragraphs)."""
    rows, cols = table["rows"], table["columns"]
    return table["endIndex"] - table["startIndex"] == 2 + rows * (1 + 2 * cols)


def table_cell_index(table, row, col):
    """Doc index of the (empty) paragraph inside cell (row, col), both 0-based.

    A table opens with 1 unit; each row adds 1 and each cell adds 2 (cell start +
    its newline), so cell (r, c) sits at start + 3 + r * (1 + 2 * cols) + 2 * c.
    """
    return table["startIndex"] + 3 + row * (1 + 2 * table["columns"]) + 2 * col


def fill_table(doc_id, table, grid, bold_header=False):
    """Write `grid` (list of rows of str) into the empty `table`; return cells written.

    Cells are filled last to first so the text added to one cell never shifts the
    index of a cell still to be written. Cells beyond the table's size are an error.
    """
    if len(grid) > table["rows"] or any(len(r) > table["columns"] for r in grid):
        die(f"Values ({len(grid)} rows) do not fit a {table['rows']}x{table['columns']} table")
    written = 0
    for r in range(len(grid) - 1, -1, -1):
        for c in range(len(grid[r]) - 1, -1, -1):
            text = grid[r][c]
            if text:
                index = table_cell_index(table, r, c)
                run_gws(["docs", "insert", doc_id, "--index", str(index), "--", text])
                written += 1
    if bold_header and grid:
        # Row 0 is filled left to right, so each cell sits after the text of the cells before it.
        offset = 0
        for c, text in enumerate(grid[0]):
            if text:
                start = table_cell_index(table, 0, c) + offset
                run_gws(["docs", "format", doc_id, str(start), str(start + utf16_len(text)), "--bold"])
            offset += utf16_len(text)
    return written


def parse_grid(raw):
    """Parse a JSON array of rows into a rectangular list of str cells (short rows padded)."""
    try:
        grid = json.loads(raw)
    except json.JSONDecodeError as e:
        die(f"Values must be a JSON array of rows, e.g. '[[\"a\",\"b\"],[1,2]]': {e}", 2)
    if not grid or not isinstance(grid, list) or not all(isinstance(r, list) and r for r in grid):
        die("Values must be a non-empty JSON array of non-empty rows", 2)
    cols = max(len(r) for r in grid)
    return [[str(v) for v in r] + [""] * (cols - len(r)) for r in grid]


def add_target_args(parser):
    """Add the shared 'which span' options used by the docs formatting wrappers."""
    where = parser.add_mutually_exclusive_group(required=True)
    where.add_argument("--range", nargs=2, type=int, metavar=("START", "END"),
                       help="character indexes (end exclusive)")
    where.add_argument("--text", help="the (case-sensitive) text to act on")
    parser.add_argument("--occurrence", type=int, default=1, help="with --text: Nth match")


def resolve_target(args, tab=None):
    """Return (start, end) from --range, or by locating --text; exit on a bad range."""
    if args.range:
        start, end = args.range
        if not 0 < start < end:
            die("Require 0 < START < END", 2)
        return start, end
    found = doc_find(args.doc_id, args.text, tab, args.occurrence)
    return found["index"], found["end_index"]


MAX_OCCURRENCES = 50


def verify_span(doc_id, start, end, expect, tab=None):
    """Exit unless the Doc text at indexes [start, end) is exactly `expect`.

    Asks the Doc where `expect` occurs (same index space the edit will use) and
    checks one match sits at exactly this span, so an index that went stale after
    another edit aborts the script instead of corrupting the doc. Text inside
    tables is never found, so a span in a table cannot be verified.
    """
    try:
        first = try_gws_find(doc_id, expect, tab, 1)
        total = min(first.get("total_occurrences") or 1, MAX_OCCURRENCES)
        for n in range(1, total + 1):
            found = first if n == 1 else try_gws_find(doc_id, expect, tab, n)
            if found["index"] == start and found["end_index"] == end:
                return
        seen = f"the text occurs {total} time(s), none at {start}-{end}"
    except GwsError as e:
        seen = f"the text was not found ({e})"
    die(
        f"Guard failed, no change made: indexes {start}-{end} no longer hold the "
        f"expected text ({seen}). Re-run docs-find for fresh indexes.",
        3,
    )


def try_gws_find(doc_id, text, tab, occurrence):
    args = ["docs", "find-text", doc_id, "--occurrence", str(occurrence)]
    if tab:
        args += ["--tab", tab]
    return try_gws(args + ["--", text])


def find_after(doc_id, text, min_index, tab=None):
    """First match of `text` starting at or after `min_index`; exit if there is none."""
    try:
        first = try_gws_find(doc_id, text, tab, 1)
        total = min(first.get("total_occurrences") or 1, MAX_OCCURRENCES)
        for n in range(1, total + 1):
            found = first if n == 1 else try_gws_find(doc_id, text, tab, n)
            if found["index"] >= min_index:
                return found
    except GwsError as e:
        die(f"Could not find {text!r}: {e}", e.code)
    die(f"No match for {text!r} at or after index {min_index}")


def sheet_tabs(sheet_id):
    """Return (title, [tab dicts with title/sheet_id/index/row_count/column_count])."""
    outer = run_gws(["sheets", "metadata", sheet_id])
    return json_field(outer, "title"), json_field(outer, "sheets")


def resolve_tab(sheet_id, title):
    """Map a tab title to its numeric sheet_id; exit listing real titles if unknown."""
    _, tabs = sheet_tabs(sheet_id)
    for tab in tabs:
        if tab.get("title") == title:
            return tab
    names = ", ".join(repr(t.get("title")) for t in tabs)
    die(f"No tab titled {title!r}. Existing tabs: {names}")


def read_values(sheet_id, range_notation=None, formulas=False):
    """Return (range, values) from `sheets read`; values is a list of rows."""
    args = ["sheets", "read", sheet_id]
    if range_notation:
        args.append(range_notation)
    if formulas:
        args.append("--formulas")
    outer = run_gws(args)
    return extract(outer.get("range", range_notation or "")), json_field(outer, "values") or []


def cell_text(value):
    """Render a cell on one line: tabs and newlines escaped."""
    return str(value).replace("\t", "\\t").replace("\n", "\\n")


def col_letters(index):
    """0-based column index -> A1 letters (0 -> A, 26 -> AA)."""
    letters = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def col_index(letters):
    """A1 column letters -> 0-based index (A -> 0, AA -> 26); inverse of col_letters."""
    if not letters.isascii() or not letters.isalpha():
        raise ValueError(f"bad column letters: {letters!r}")
    index = 0
    for ch in letters.upper():
        index = index * 26 + ord(ch) - 64
    return index - 1


def split_a1(a1):
    """Split 'Tab!A1:B2' into (tab_title, 'A1:B2'); the tab prefix is required.

    A quoted title ('My Tab'!A1) may hold spaces, '!' and '' (an escaped apostrophe).
    """
    no_tab = ValueError("range needs a tab: Tab!A1:B2")
    if a1.startswith("'"):
        title, i = [], 1
        while i < len(a1):
            if a1[i] == "'":
                if a1[i + 1 : i + 2] == "'":
                    title.append("'")
                    i += 2
                    continue
                break
            title.append(a1[i])
            i += 1
        if i >= len(a1) or a1[i + 1 : i + 2] != "!":
            raise no_tab
        title, cells = "".join(title), a1[i + 2 :]
    else:
        title, sep, cells = a1.rpartition("!")
        if not sep:
            raise no_tab
    if not title or not cells:
        raise no_tab
    return title, cells


def _a1_part(part, whole):
    """Parse one side of a range ('B2', 'B', '2', '$B$2') into (col_index|None, row_number|None)."""
    m = re.fullmatch(r"\$?([A-Za-z]*)\$?([0-9]*)", part)
    if not m or not (m.group(1) or m.group(2)):
        raise ValueError(f"bad range {whole!r}")
    col = col_index(m.group(1)) if m.group(1) else None
    row = int(m.group(2)) if m.group(2) else None
    if row == 0:
        raise ValueError(f"rows start at 1 in {whole!r}")
    return col, row


def a1_to_grid(a1, tabs):
    """Convert 'Tab!A1:C3' to (tab_dict, r0, r1, c0, c1): 0-based, end-exclusive.

    `tabs` is the tab list from sheet_tabs. Accepts B2, A1:C3, whole columns A:C,
    whole rows 2:5 and open-ended A2:C (down to the tab's last row).
    """
    title, cells = split_a1(a1)
    tab = next((t for t in tabs if t.get("title") == title), None)
    if tab is None:
        names = ", ".join(repr(t.get("title")) for t in tabs)
        raise ValueError(f"No tab titled {title!r}. Existing tabs: {names}")
    rows, cols = int(tab.get("row_count", 0)), int(tab.get("column_count", 0))

    sides = cells.split(":")
    if len(sides) > 2:
        raise ValueError(f"bad range {cells!r}")
    first = _a1_part(sides[0], cells)
    if len(sides) == 1:
        if None in first:
            raise ValueError(f"single cell needs a column and a row: {cells!r}")
        (c0, r0), (c1, r1) = first, first
    else:
        last = _a1_part(sides[1], cells)
        has = [(c is not None, r is not None) for c, r in (first, last)]
        if has == [(True, True), (True, True)]:
            (c0, r0), (c1, r1) = first, last
        elif has == [(True, False), (True, False)]:
            (c0, _), (c1, _) = first, last
            r0, r1 = 1, rows
        elif has == [(False, True), (False, True)]:
            (_, r0), (_, r1) = first, last
            c0, c1 = 0, cols - 1
        elif has == [(True, True), (True, False)]:
            (c0, r0), (c1, _) = first, last
            r1 = rows
        else:
            raise ValueError(f"unsupported range {cells!r}: use A1:C3, A:C, 2:5 or A2:C")
    r0 -= 1
    if r1 <= r0 or c1 < c0:
        raise ValueError(f"empty or reversed range {cells!r}")
    return tab, r0, r1, c0, c1 + 1


def resolve_range(sheet_id, a1):
    """Fetch the tabs and convert `a1` to (tab_dict, r0, r1, c0, c1); exit on a bad range."""
    _, tabs = sheet_tabs(sheet_id)
    try:
        return a1_to_grid(a1, tabs)
    except ValueError as e:
        die(str(e), 2)


def check_hex(color):
    """Validate '#RGB'/'#RRGGBB' (the '#' is optional); return it with the '#'."""
    m = re.fullmatch(r"#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})", color)
    if not m:
        raise ValueError(f"bad colour {color!r}: use #RGB or #RRGGBB")
    return "#" + m.group(1)


def rgb_to_hex(color):
    """API colour (floats 0..1, zero channels omitted) -> '#RRGGBB'."""
    channels = (round(min(max(color.get(k, 0), 0), 1) * 255) for k in ("red", "green", "blue"))
    return "#" + "".join(f"{c:02X}" for c in channels)


def grid_to_a1(tab_title, r0, r1, c0, c1):
    """Display form of a 0-based end-exclusive grid range: 'Tab'!A1:C3 (tab quoted if needed)."""
    tab = tab_title if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", tab_title) else "'" + tab_title.replace("'", "''") + "'"
    start = f"{col_letters(c0)}{r0 + 1}"
    if (r1 - r0, c1 - c0) == (1, 1):
        return f"{tab}!{start}"
    return f"{tab}!{start}:{col_letters(c1 - 1)}{r1}"


def describe_chart(chart, tab_titles_by_id):
    """One line for an embedded chart: id | tab | type | title | anchor | WxH | N series."""
    spec = chart.get("spec", {})
    position = chart.get("position", {})
    overlay = position.get("overlayPosition")
    if overlay:
        anchor_cell = overlay.get("anchorCell", {})
        tab = tab_titles_by_id.get(anchor_cell.get("sheetId", 0), "?")
        anchor = f"{col_letters(anchor_cell.get('columnIndex', 0))}{anchor_cell.get('rowIndex', 0) + 1}"
        size = f"{overlay.get('widthPixels', '?')}x{overlay.get('heightPixels', '?')}"
    else:
        tab = tab_titles_by_id.get(position.get("sheetId", 0), "?")
        anchor, size = "-", "-"
    if "basicChart" in spec:
        kind, count = spec["basicChart"].get("chartType", "?"), len(spec["basicChart"].get("series", []))
    elif "pieChart" in spec:
        kind, count = "PIE", 1 if spec["pieChart"].get("series") else 0
    else:
        kind = next((k[:-5].upper() for k in spec if k.endswith("Chart")), "?")
        count = "?"
    title = spec.get("title") or "(untitled)"
    return f"{chart.get('chartId')} | {tab} | {kind} | {title} | {anchor} | {size} | {count} series"


def print_inspect_before(spreadsheet_id, inspect_args):
    """Print the sibling sheets-inspect output under 'Before:'; exit if it fails.

    Destructive wrappers call this first so nothing is changed when the current
    state cannot be shown.
    """
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheets-inspect")
    result = subprocess.run(
        [script, spreadsheet_id, *inspect_args], check=False, capture_output=True, text=True
    )
    if result.returncode != 0:
        die(f"sheets-inspect failed, nothing changed: {result.stderr.strip()}", result.returncode)
    print("Before:")
    print(result.stdout.rstrip())


def range_preview(content, start, end):
    """Text at Doc indexes [start, end) assuming a plain-text body (offset = index - 1).

    Returns None when the range falls outside the text read back. Tables and
    non-BMP characters make the offsets drift, so callers must say it is a guess.
    """
    if start < 1 or end - 1 > len(content):
        return None
    return content[start - 1 : end - 1]


def replace_span(doc_id, start, end, text, tab=None):
    """Replace Doc indexes [start, end) with `text` via insert-then-delete.

    Inserting at `end` first leaves [start, end) valid, so the delete needs no
    index adjustment. The two calls are not atomic: if the delete fails, the new
    text is already in the doc after the old span, and we say so before exiting.
    """
    tab_args = ["--tab", tab] if tab else []
    if text:
        run_gws(["docs", "insert", doc_id, "--index", str(end)] + tab_args + ["--", text])
    try:
        try_gws(["docs", "delete", doc_id] + tab_args + ["--", str(start), str(end)])
    except GwsError as e:
        die(
            f"Delete of indexes {start}-{end} failed ({e}). The doc is half-edited: "
            f"the new text was already inserted at index {end}, right after the old "
            "text, which is still present. Re-run docs-find and remove the old span.",
            e.code,
        )
