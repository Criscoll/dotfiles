"""Batch text/paragraph styling for a Google Doc in ONE read and ONE batchUpdate.

Not run directly. `_gws_workspace.batch_format` executes it inside gws-cli's own
environment (`uvx --from gws-cli python <this file>`) so it reuses gws-cli's
authentication. It reads {"doc_id", "tab", "rules", "dry_run"} as JSON on stdin and
prints a JSON summary on stdout.

Only updateTextStyle and updateParagraphStyle requests are ever built here:
styling never changes document text, so indexes stay valid across the whole batch.

Each rule picks spans with exactly one of:
  "text"     literal, case-sensitive
  "pattern"  regular expression (Python re, MULTILINE)
  "range"    [start, end) document indexes
and optionally "occurrence" (1-based; omitted = every match). Style keys:
  bold, italic, underline (bool), size (pt), color (#RRGGBB), link (URL)
  heading (normal|title|subtitle|h1..h6), align (start|center|end|justified)
heading/align restyle every paragraph overlapping a match.
"""

import json
import re
import sys

from googleapiclient.errors import HttpError

from gws.services.docs import DocsService

NAMED_STYLES = {
    "normal": "NORMAL_TEXT",
    "title": "TITLE",
    "subtitle": "SUBTITLE",
    **{f"h{n}": f"HEADING_{n}" for n in range(1, 7)},
}
TEXT_KEYS = ("bold", "italic", "underline", "size", "color", "link")
PARA_KEYS = ("heading", "align")


def fail(msg, code=1):
    print(json.dumps({"status": "error", "message": msg}))
    sys.exit(code)


def find_tab_body(tabs, tab_id):
    for t in tabs:
        if t.get("tabProperties", {}).get("tabId") == tab_id:
            return t.get("documentTab", {}).get("body", {})
        found = find_tab_body(t.get("childTabs", []), tab_id)
        if found is not None:
            return found
    return None


def walk(content, chars, idx, paragraphs):
    """Flatten text into `chars` with a doc index per char; collect paragraph spans."""
    for el in content:
        if "paragraph" in el:
            paragraphs.append((el["startIndex"], el["endIndex"]))
            for run in el["paragraph"].get("elements", []):
                text = run.get("textRun", {}).get("content")
                if text is None:
                    continue
                pos = run["startIndex"]
                for ch in text:
                    chars.append(ch)
                    idx.append(pos)
                    pos += 2 if ord(ch) > 0xFFFF else 1
        elif "table" in el:
            for row in el["table"].get("tableRows", []):
                for cell in row.get("tableCells", []):
                    walk(cell.get("content", []), chars, idx, paragraphs)


def rgb(hex_color):
    h = hex_color.lstrip("#")
    if not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        fail(f"Bad colour {hex_color!r}, expected #RRGGBB")
    return {k: int(h[i:i + 2], 16) / 255 for k, i in (("red", 0), ("green", 2), ("blue", 4))}


def spans_for(rule, text, idx):
    """Return [(start, end)] doc-index spans selected by one rule."""
    targets = [k for k in ("text", "pattern", "range") if k in rule]
    if len(targets) != 1:
        fail(f"Rule needs exactly one of text/pattern/range: {rule}")
    if "range" in rule:
        start, end = rule["range"]
        return [(start, end)]
    regex = re.compile(re.escape(rule["text"]) if "text" in rule else rule["pattern"], re.M)
    spans = []
    for m in regex.finditer(text):
        if m.end() == m.start():
            continue
        last = m.end() - 1
        spans.append((idx[m.start()], idx[last] + (2 if ord(text[last]) > 0xFFFF else 1)))
    if "occurrence" in rule:
        n = rule["occurrence"]
        spans = spans[n - 1:n] if 1 <= n <= len(spans) else []
    return spans


def build_requests(rule, spans, paragraphs, tab):
    reqs = []
    tab_part = {"tabId": tab} if tab else {}
    style, fields = {}, []
    for key in ("bold", "italic", "underline"):
        if key in rule:
            style[key] = rule[key]
            fields.append(key)
    if "size" in rule:
        style["fontSize"] = {"magnitude": rule["size"], "unit": "PT"}
        fields.append("fontSize")
    if "color" in rule:
        style["foregroundColor"] = {"color": {"rgbColor": rgb(rule["color"])}}
        fields.append("foregroundColor")
    if "link" in rule:
        style["link"] = {"url": rule["link"]}
        fields.append("link")

    pstyle, pfields = {}, []
    if "heading" in rule:
        if rule["heading"] not in NAMED_STYLES:
            fail(f"Unknown heading {rule['heading']!r}; use {sorted(NAMED_STYLES)}")
        pstyle["namedStyleType"] = NAMED_STYLES[rule["heading"]]
        pfields.append("namedStyleType")
    if "align" in rule:
        pstyle["alignment"] = rule["align"].upper()
        pfields.append("alignment")

    if not (fields or pfields):
        fail(f"Rule has no style keys ({TEXT_KEYS + PARA_KEYS}): {rule}")

    for start, end in spans:
        if fields:
            reqs.append({"updateTextStyle": {
                "range": {"startIndex": start, "endIndex": end, **tab_part},
                "textStyle": style, "fields": ",".join(fields)}})
        if pfields:
            for p_start, p_end in paragraphs:
                if p_start < end and p_end > start:
                    reqs.append({"updateParagraphStyle": {
                        "range": {"startIndex": p_start, "endIndex": p_end, **tab_part},
                        "paragraphStyle": pstyle, "fields": ",".join(pfields)}})
    return reqs


def main():
    job = json.load(sys.stdin)
    doc_id, tab, rules = job["doc_id"], job.get("tab"), job["rules"]
    if not rules:
        fail("No rules given")

    svc = DocsService()
    try:
        doc = svc.execute(svc.service.documents().get(documentId=doc_id, includeTabsContent=True))
        if tab:
            body = find_tab_body(doc.get("tabs", []), tab)
            if body is None:
                fail(f"Tab {tab!r} not found")
        else:
            tabs = doc.get("tabs")
            body = tabs[0]["documentTab"]["body"] if tabs else doc.get("body", {})

        chars, idx, paragraphs = [], [], []
        walk(body.get("content", []), chars, idx, paragraphs)
        text = "".join(chars)

        requests, report = [], []
        for i, rule in enumerate(rules, 1):
            spans = spans_for(rule, text, idx)
            report.append({"rule": i, "matches": len(spans),
                           "spans": [list(s) for s in spans[:5]]})
            requests += build_requests(rule, spans, paragraphs, tab)

        if requests and not job.get("dry_run"):
            svc.execute(svc.service.documents().batchUpdate(
                documentId=doc_id, body={"requests": requests}))
    except HttpError as e:
        fail(f"Google Docs API error: {e.reason}")

    print(json.dumps({"status": "success", "dry_run": bool(job.get("dry_run")),
                      "requests": len(requests), "rules": report}))


if __name__ == "__main__":
    main()
