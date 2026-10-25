#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest==9.1.1"]
# ///
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import _gws_workspace as gws

TABS = [
    {"title": "Data", "sheet_id": 0, "index": 0, "row_count": 100, "column_count": 26},
    {"title": "My Tab", "sheet_id": 11, "index": 1, "row_count": 50, "column_count": 8},
    {"title": "Wow!", "sheet_id": 12, "index": 2, "row_count": 10, "column_count": 4},
    {"title": "it's", "sheet_id": 13, "index": 3, "row_count": 10, "column_count": 4},
]


class TestColumns:
    @pytest.mark.parametrize("letters, index", [
        ("A", 0), ("B", 1), ("Z", 25), ("AA", 26), ("AZ", 51), ("BA", 52), ("ZZ", 701), ("AAA", 702),
    ])
    def test_round_trip(self, letters, index):
        assert gws.col_index(letters) == index
        assert gws.col_letters(index) == letters

    def test_lowercase_accepted(self):
        assert gws.col_index("aa") == 26

    @pytest.mark.parametrize("bad", ["", "A1", "1", "A-", "é"])
    def test_bad_letters(self, bad):
        with pytest.raises(ValueError):
            gws.col_index(bad)


class TestSplitA1:
    @pytest.mark.parametrize("a1, expected", [
        ("Data!A1", ("Data", "A1")),
        ("Data!A1:C3", ("Data", "A1:C3")),
        ("'My Tab'!A1:B2", ("My Tab", "A1:B2")),
        ("'it''s'!B2", ("it's", "B2")),
        ("'Wow!'!A1:A3", ("Wow!", "A1:A3")),
        ("'a!b''c'!C:C", ("a!b'c", "C:C")),
        ("Data!2:5", ("Data", "2:5")),
    ])
    def test_forms(self, a1, expected):
        assert gws.split_a1(a1) == expected

    @pytest.mark.parametrize("bad", ["A1", "A1:B2", "", "Data!", "!A1", "'Data'A1", "'Data!A1", "'Data'"])
    def test_needs_tab(self, bad):
        with pytest.raises(ValueError, match="range needs a tab: Tab!A1:B2"):
            gws.split_a1(bad)


class TestA1ToGrid:
    @pytest.mark.parametrize("a1, expected", [
        ("Data!B2", (1, 2, 1, 2)),
        ("Data!A1:C3", (0, 3, 0, 3)),
        ("Data!A1:D1", (0, 1, 0, 4)),
        ("Data!A:C", (0, 100, 0, 3)),
        ("Data!A:A", (0, 100, 0, 1)),
        ("Data!2:5", (1, 5, 0, 26)),
        ("Data!3:3", (2, 3, 0, 26)),
        ("Data!A2:C", (1, 100, 0, 3)),
        ("Data!$A$1:$B$2", (0, 2, 0, 2)),
        ("Data!aa10:ab11", (9, 11, 26, 28)),
        ("'My Tab'!A1:B2", (0, 2, 0, 2)),
        ("'My Tab'!A:B", (0, 50, 0, 2)),
        ("'My Tab'!2:3", (1, 3, 0, 8)),
        ("'Wow!'!A1", (0, 1, 0, 1)),
        ("'it''s'!C4", (3, 4, 2, 3)),
    ])
    def test_forms(self, a1, expected):
        tab, *bounds = gws.a1_to_grid(a1, TABS)
        assert tuple(bounds) == expected
        assert tab["title"] == gws.split_a1(a1)[0]

    def test_returns_the_tab_dict(self):
        tab, *_ = gws.a1_to_grid("'My Tab'!A1", TABS)
        assert tab["sheet_id"] == 11

    @pytest.mark.parametrize("a1", ["Data!C3:A1", "Data!A3:C1", "Data!5:2", "Data!C:A", "Data!A200:C"])
    def test_reversed_or_empty(self, a1):
        with pytest.raises(ValueError, match="reversed"):
            gws.a1_to_grid(a1, TABS)

    def test_unknown_tab_lists_real_titles(self):
        with pytest.raises(ValueError) as exc:
            gws.a1_to_grid("Nope!A1", TABS)
        message = str(exc.value)
        assert "'Nope'" in message
        assert "'Data'" in message and "'My Tab'" in message

    @pytest.mark.parametrize("a1", [
        "Data!A", "Data!5", "Data!A0", "Data!A1:B2:C3", "Data!A1:", "Data!A:5", "Data!A1:5",
        "Data!A:C3", "Data!1A", "Data!A1B2", "Data!--",
    ])
    def test_bad_ranges(self, a1):
        with pytest.raises(ValueError):
            gws.a1_to_grid(a1, TABS)

    def test_needs_tab(self):
        with pytest.raises(ValueError, match="range needs a tab"):
            gws.a1_to_grid("A1:B2", TABS)


class TestGridToA1:
    @pytest.mark.parametrize("args, expected", [
        (("Data", 0, 1, 0, 1), "Data!A1"),
        (("Data", 0, 3, 0, 3), "Data!A1:C3"),
        (("My Tab", 1, 5, 26, 28), "'My Tab'!AA2:AB5"),
        (("it's", 0, 2, 0, 2), "'it''s'!A1:B2"),
    ])
    def test_display(self, args, expected):
        assert gws.grid_to_a1(*args) == expected

    def test_round_trip(self):
        tab, *bounds = gws.a1_to_grid("'My Tab'!B2:D7", TABS)
        assert gws.grid_to_a1(tab["title"], *bounds) == "'My Tab'!B2:D7"


class TestColours:
    @pytest.mark.parametrize("given, expected", [
        ("#fff", "#fff"), ("FFF", "#FFF"), ("#DDDDDD", "#DDDDDD"), ("ffcccc", "#ffcccc"),
    ])
    def test_check_hex_accepts(self, given, expected):
        assert gws.check_hex(given) == expected

    @pytest.mark.parametrize("bad", ["", "#", "#12", "#1234", "#12345", "#1234567", "#GGG", "red", "##fff"])
    def test_check_hex_rejects(self, bad):
        with pytest.raises(ValueError, match="bad colour"):
            gws.check_hex(bad)

    @pytest.mark.parametrize("color, expected", [
        ({"red": 1, "green": 1, "blue": 1}, "#FFFFFF"),
        ({"red": 0.8666667, "green": 0.8666667, "blue": 0.8666667}, "#DDDDDD"),
        ({"red": 1}, "#FF0000"),
        ({"green": 1}, "#00FF00"),
        ({"blue": 0.5}, "#000080"),
        ({}, "#000000"),
        ({"red": 2, "green": -1}, "#FF0000"),
    ])
    def test_rgb_to_hex(self, color, expected):
        assert gws.rgb_to_hex(color) == expected


TITLES = {0: "Data", 11: "My Tab"}


class TestDescribeChart:
    def test_basic_chart(self):
        chart = {
            "chartId": 42,
            "spec": {
                "title": "Qty",
                "basicChart": {"chartType": "COLUMN", "series": [{}, {}]},
            },
            "position": {"overlayPosition": {
                "anchorCell": {"sheetId": 11, "rowIndex": 2, "columnIndex": 27},
                "widthPixels": 600, "heightPixels": 400,
            }},
        }
        assert gws.describe_chart(chart, TITLES) == "42 | My Tab | COLUMN | Qty | AB3 | 600x400 | 2 series"

    def test_zero_omitted_anchor_defaults_to_first_tab_a1(self):
        chart = {
            "chartId": 7,
            "spec": {"pieChart": {"series": {"sourceRange": {}}}},
            "position": {"overlayPosition": {"anchorCell": {}, "widthPixels": 300}},
        }
        assert gws.describe_chart(chart, TITLES) == "7 | Data | PIE | (untitled) | A1 | 300x? | 1 series"

    def test_own_sheet_chart_has_no_anchor(self):
        chart = {"chartId": 9, "spec": {"histogramChart": {}}, "position": {"sheetId": 11, "newSheet": True}}
        assert gws.describe_chart(chart, TITLES) == "9 | My Tab | HISTOGRAM | (untitled) | - | - | ? series"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
