#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pytest==9.1.1"]
# ///
import importlib.util
import json
import subprocess
import sys
from importlib.machinery import SourceFileLoader
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parent.parent / "finance"
_loader = SourceFileLoader("finance_script", str(_SCRIPT))
_spec = importlib.util.spec_from_loader(_loader.name, _loader)
finance = importlib.util.module_from_spec(_spec)
_loader.exec_module(finance)


def run_cmd(*argv):
    """Parse argv through the real build_parser() and invoke the matched cmd_* handler."""
    args = finance.build_parser().parse_args(argv)
    return args.func(args)


# --- Helper unit tests (shared TVM math, independent of any subcommand) -------


class TestMoneyHelper:
    def test_kills_float_artifacts(self):
        assert finance._money(1798.6500000001) == 1798.65

    def test_rounds_half_up_not_bankers(self):
        # 0.125 is exact in binary; HALF_UP rounds away from zero (0.13), unlike
        # banker's rounding which would round to the even digit (0.12).
        assert finance._money(0.125) == 0.13


class TestFvPvInverse:
    def test_fv_and_pv_are_inverses(self):
        pv, pmt, i, n = 1000.0, 50.0, 0.005, 24
        fv = finance._fv(pv, pmt, i, n, "end")
        assert finance._pv(fv, pmt, i, n, "end") == pytest.approx(pv)


class TestPmtHelper:
    def test_matches_hand_computed_mortgage(self):
        i = (6 / 100) / 12
        payment = finance._pmt(300000, i, 360)
        assert payment == pytest.approx(1798.6515754582708)


class TestYearsMonthsHelper:
    def test_normal_case(self):
        assert finance._years_months(360, 12) == (30, 0)

    def test_rounds_up_into_next_year(self):
        # 51/52 * 12 = 11.769... months, which rounds to 12 and must bump the year.
        assert finance._years_months(51, 52) == (1, 0)


# --- One test class per subcommand --------------------------------------------


class TestMortgage:
    def test_known_principal_rate_years(self):
        result = run_cmd("mortgage", "--principal", "300000", "--rate", "6", "--years", "30")
        assert result["payment_per_period"] == pytest.approx(1798.65, abs=0.01)
        assert result["total_interest"] == pytest.approx(
            result["total_paid"] - result["principal"], abs=0.01
        )

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("mortgage", "--principal", "-1", "--rate", "6", "--years", "30")
        assert exc_info.value.code == 2


class TestPayoff:
    def test_fixed_payment_matches_mortgage_period_count(self):
        i = (6 / 100) / 12
        exact_payment = finance._pmt(300000, i, 360)
        result = run_cmd(
            "payoff", "--balance", "300000", "--rate", "6", "--payment", str(exact_payment)
        )
        assert result["periods_to_payoff"] == 360

    def test_interest_only_guard_raises(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("payoff", "--balance", "100000", "--rate", "6", "--payment", "500")
        assert exc_info.value.code == 2

    def test_net_offset_covering_balance_finishes_immediately(self):
        result = run_cmd(
            "payoff", "--balance", "1000", "--rate", "6", "--payment", "50",
            "--offset", "1000", "--offset-mode", "net",
        )
        assert result["periods_to_payoff"] == 0


class TestProgressiveTax:
    def test_hand_computed_two_brackets(self):
        result = run_cmd(
            "progressive-tax", "--income", "15000",
            "--bracket", "10000:10", "--bracket", "inf:20",
        )
        assert result["base_tax"] == pytest.approx(2000.0)
        assert result["result"] == pytest.approx(2000.0)

    def test_flat_rate_lower_of_the_two_wins(self):
        result = run_cmd(
            "progressive-tax", "--income", "15000",
            "--bracket", "10000:10", "--bracket", "inf:20", "--flat-rate", "5",
        )
        assert result["methods"]["flat"] == pytest.approx(750.0)
        assert result["method_used"] == "flat"
        assert result["result"] == pytest.approx(750.0)


class TestCompound:
    def test_happy_path(self):
        result = run_cmd(
            "compound", "--principal", "1000", "--rate", "5", "--years", "10", "--n", "12"
        )
        expected = 1000 * (1 + 0.05 / 12) ** 120
        assert result["future_value"] == pytest.approx(expected, abs=0.01)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("compound", "--principal", "-1", "--rate", "5", "--years", "10")
        assert exc_info.value.code == 2


class TestPv:
    def test_happy_path(self):
        result = run_cmd("pv", "--future-value", "1000", "--rate", "5", "--years", "10", "--n", "12")
        expected = 1000 / ((1 + 0.05 / 12) ** 120)
        assert result["present_value"] == pytest.approx(expected, abs=0.01)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("pv", "--future-value", "0", "--rate", "5", "--years", "10")
        assert exc_info.value.code == 2


class TestFv:
    def test_happy_path(self):
        result = run_cmd("fv", "--present-value", "1000", "--rate", "5", "--years", "10", "--n", "12")
        expected = 1000 * (1 + 0.05 / 12) ** 120
        assert result["future_value"] == pytest.approx(expected, abs=0.01)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("fv", "--present-value", "-1", "--rate", "5", "--years", "10")
        assert exc_info.value.code == 2


class TestAppreciate:
    def test_happy_path(self):
        result = run_cmd("appreciate", "--value", "1000", "--rate", "5", "--years", "10")
        expected = 1000 * (1.05) ** 10
        assert result["final_value"] == pytest.approx(expected, abs=0.01)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("appreciate", "--value", "0", "--rate", "5", "--years", "10")
        assert exc_info.value.code == 2


class TestDepreciate:
    def test_straight_line_and_year_lookup(self):
        result = run_cmd(
            "depreciate", "--cost", "10000", "--salvage", "1000", "--life", "5",
            "--method", "straight", "--year", "3",
        )
        assert result["schedule"][0]["depreciation"] == pytest.approx(1800.0)
        assert result["book_value_at_year"] == pytest.approx(4600.0)

    def test_declining_balance(self):
        result = run_cmd(
            "depreciate", "--cost", "10000", "--life", "5", "--method", "declining", "--factor", "2",
        )
        assert result["schedule"][0]["depreciation"] == pytest.approx(4000.0)
        assert result["schedule"][1]["depreciation"] == pytest.approx(2400.0)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("depreciate", "--cost", "0", "--life", "5")
        assert exc_info.value.code == 2


class TestCagr:
    def test_happy_path(self):
        result = run_cmd("cagr", "--start", "1000", "--end", "2000", "--years", "10")
        expected = ((2000 / 1000) ** (1 / 10) - 1) * 100
        assert result["cagr_pct"] == pytest.approx(expected, abs=1e-4)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("cagr", "--start", "0", "--end", "2000", "--years", "10")
        assert exc_info.value.code == 2


class TestRoi:
    def test_happy_path(self):
        result = run_cmd("roi", "--cost", "1000", "--gain", "200")
        assert result["roi_pct"] == pytest.approx(20.0)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("roi", "--cost", "0", "--gain", "200")
        assert exc_info.value.code == 2


class TestPctChange:
    def test_happy_path(self):
        result = run_cmd("pct-change", "--from", "100", "--to", "150")
        assert result["pct_change"] == pytest.approx(50.0)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("pct-change", "--from", "0", "--to", "150")
        assert exc_info.value.code == 2


class TestEar:
    def test_happy_path(self):
        result = run_cmd("ear", "--rate", "12", "--n", "12")
        expected = ((1 + 0.12 / 12) ** 12 - 1) * 100
        assert result["effective_annual_rate_pct"] == pytest.approx(expected, abs=1e-4)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("ear", "--rate", "12", "--n", "0")
        assert exc_info.value.code == 2


class TestSavingsGoal:
    def test_happy_path(self):
        result = run_cmd("savings-goal", "--target", "10000", "--rate", "5", "--years", "5", "--n", "12")
        i = (5 / 100) / 12
        periods = 60
        growth = (1 + i) ** periods
        expected = (10000 - 0 * growth) * i / (growth - 1)
        assert result["required_contribution_per_period"] == pytest.approx(expected, abs=0.01)

    def test_validation_error(self):
        with pytest.raises(SystemExit) as exc_info:
            run_cmd("savings-goal", "--target", "0", "--rate", "5", "--years", "5")
        assert exc_info.value.code == 2


# --- CLI contract (subprocess, exercises real argparse subparser wiring) ------


class TestCli:
    def test_mortgage_smoke(self):
        proc = subprocess.run(
            [str(_SCRIPT), "mortgage", "--principal", "300000", "--rate", "6", "--years", "30"],
            capture_output=True, text=True, check=False,
        )
        assert proc.returncode == 0
        payload = json.loads(proc.stdout)
        assert payload["command"] == "mortgage"
        assert payload["payment_per_period"] == pytest.approx(1798.65, abs=0.01)

    def test_progressive_tax_repeated_bracket_flags(self):
        proc = subprocess.run(
            [
                str(_SCRIPT), "progressive-tax", "--income", "15000",
                "--bracket", "10000:10", "--bracket", "inf:20",
            ],
            capture_output=True, text=True, check=False,
        )
        assert proc.returncode == 0
        payload = json.loads(proc.stdout)
        assert payload["command"] == "progressive-tax"
        assert payload["base_tax"] == pytest.approx(2000.0)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
