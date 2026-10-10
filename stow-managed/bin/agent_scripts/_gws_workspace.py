"""Shared helpers for the docs-* and sheets-* gws-cli wrappers.

Imported (not executed) by the wrapper scripts via
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))). The only I/O is
the gws-cli subprocess call.
"""

import json
import subprocess
import sys

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
