#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest==9.1.1"]
# ///
import importlib.util
import json
import math
import subprocess
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parent.parent / "calculator"
_loader = SourceFileLoader("calculator_script", str(_SCRIPT))
_spec = importlib.util.spec_from_loader(_loader.name, _loader)
calculator = importlib.util.module_from_spec(_spec)
_loader.exec_module(calculator)

evaluate = calculator.evaluate
UnsafeExpression = calculator.UnsafeExpression


class TestArithmetic:
    @pytest.mark.parametrize("expr, expected", [
        ("2 + 3", 5),
        ("5 - 2", 3),
        ("4 * 3", 12),
        ("7 / 2", 3.5),
        ("7 // 2", 3),
        ("7 % 2", 1),
        ("2 ** 10", 1024),
        ("+5", 5),
        ("-5", -5),
        ("-(3 + 2)", -5),
    ])
    def test_operators(self, expr, expected):
        assert evaluate(expr) == expected

    def test_large_power_is_exact_int_not_float(self):
        result = evaluate("2**64 - 1")
        assert result == 2**64 - 1
        assert isinstance(result, int)


class TestMathFunctionsAndConstants:
    @pytest.mark.parametrize("expr, expected", [
        ("sqrt(16)", math.sqrt(16)),
        ("factorial(6)", math.factorial(6)),
        ("log2(1024)", math.log2(1024)),
        ("log10(1000)", math.log10(1000)),
        ("sin(0)", math.sin(0)),
        ("pi", math.pi),
        ("e", math.e),
        ("tau", math.tau),
    ])
    def test_matches_math_module(self, expr, expected):
        assert evaluate(expr) == expected


class TestComparisons:
    def test_chained_comparison_true(self):
        assert evaluate("1 < 2 <= 10") is True

    def test_chained_comparison_false_returns_false_not_error(self):
        assert evaluate("5 < 3") is False

    def test_equality(self):
        assert evaluate("4 == 4") is True


class TestListsTuplesAndBuiltins:
    def test_sum_of_list(self):
        assert evaluate("sum([1, 2, 3])") == 6

    def test_min_of_tuple(self):
        assert evaluate("min((4, 5, 6))") == 4

    def test_nested_builtins(self):
        assert evaluate("max(abs(-5), 3)") == 5


class TestSecurityBoundary:
    """The AST allow-list is the entire safety mechanism standing in for eval()."""

    @pytest.mark.parametrize("expr", [
        "__import__('os')",
        "().__class__",
        "open('/etc/passwd')",
        "math.sqrt(4)",
        "undefined_name_xyz",
        "True",
        "bool",
    ])
    def test_rejected_expressions_raise_unsafe(self, expr):
        with pytest.raises(UnsafeExpression):
            evaluate(expr)


class TestErrorHandling:
    def test_division_by_zero_raises(self):
        with pytest.raises(ZeroDivisionError):
            evaluate("1 / 0")

    def test_malformed_syntax_raises_unsafe(self):
        with pytest.raises(UnsafeExpression):
            evaluate("2 +")


class TestCli:
    def test_valid_expression_prints_json_exit_0(self):
        proc = subprocess.run(
            [str(_SCRIPT), "2 + 2"], capture_output=True, text=True, check=False,
        )
        assert proc.returncode == 0
        assert json.loads(proc.stdout) == {"expression": "2 + 2", "result": 4}

    def test_rejected_expression_exits_2_with_error(self):
        proc = subprocess.run(
            [str(_SCRIPT), "__import__('os')"], capture_output=True, text=True, check=False,
        )
        assert proc.returncode == 2
        assert "Error" in proc.stderr


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
