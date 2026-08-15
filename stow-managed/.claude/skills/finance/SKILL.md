---
name: finance
description: >-
  Run money math exactly with the deterministic `~/bin/agent_scripts/finance`
  script instead of deriving formulas or computing in your head — financial
  answers are where a wrong digit matters, and LLM mental arithmetic is
  unreliable. Auto-invoke BEFORE answering anything involving: mortgage or loan
  repayments, "how long to pay off" a balance/credit card, compound interest or
  investment growth, regular contributions/annuities, present or future value,
  asset appreciation or depreciation, CAGR, ROI, effective annual rate
  (APR→EAR), or "how much must I save per month" — even if the user did not
  explicitly ask for a tool. Trigger phrases: "mortgage", "repayment", "monthly
  payment", "loan", "how long to pay off", "compound interest", "future value",
  "present value", "how much will it be worth", "depreciation", "book value",
  "CAGR", "growth rate", "ROI", "APR", "EAR", "effective rate", "savings goal".
  Currency/FX is separate — use the currency and landed-cost scripts.
disable-model-invocation: false
---

Do financial calculations with `~/bin/agent_scripts/finance`, never by deriving the
formula and computing mentally. It runs the exact time-value-of-money math (amortization,
compounding annuities, an exact month-by-month payoff simulation) in one deterministic,
auditable script — money outputs rounded to cents half-up. This is the whole point: an LLM
working repayment schedules or compounding in its head is guessing, and a wrong digit in a
mortgage or payoff answer is a real error.

**Currency-agnostic:** every input and output is a plain number in whatever unit you feed it
(dollars, euros, yen). It does no FX. Mixing currencies is on you — convert first (see below).

## Script Check — Do This First

`finance` lives in `agent_scripts/` and is deliberately not on `$PATH`. Call by full path:

```bash
ls ~/bin/agent_scripts/finance
```

If missing, stow from the dotfiles repo hasn't been run or the file wasn't created. Do not
fall back to computing the answer yourself — surface the problem instead.

## Conventions (all subcommands)

- **`--rate` is a percent**, not a fraction: `--rate 6` means 6% per year.
- Output is JSON on stdout; the primary answer is under `"result"`, with a fuller breakdown
  alongside it. Errors (bad/negative inputs, an unpayable balance) print to stderr and exit `2`.
- **`--n`** = compounding periods per year (12 = monthly, 4 = quarterly, 1 = annual).
- **`--pay-freq`** (mortgage/payoff) = `monthly` (default) | `fortnightly` | `weekly` →
  12 / 26 / 52 periods per year.
- **`--dp N`** overrides money decimal places (default 2). Rates/percentages are always 6 dp.

## Subcommands

### `mortgage` — amortized loan payment

```bash
~/bin/agent_scripts/finance mortgage --principal 300000 --rate 6 --years 30
```

`result` = payment per period; also `num_payments`, `total_paid`, `total_interest`. Add
`--pay-freq fortnightly` for accelerated schedules.

### `payoff` — time to clear a balance

Two input modes. Payment mode (you know the payment):

```bash
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 1798.65
```

Income mode (derive `payment = income − expenses` per period):

```bash
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --income 3000 --expenses 500
```

`result` = periods to payoff; also `years_months`, `final_payment` (the partial last one),
`total_paid`, `total_interest`. Optional `--extra E` (paid every period) and repeatable
`--lump AMT@PERIOD` (e.g. `--lump 5000@12`). If the payment can't cover the interest, it
errors with the exact interest-only figure — the balance would never amortize.

**Offset account** — feed `--balance` and `--offset` *separately*; never hand-collapse
`loan − offset` into one net balance (that manual translation is where double-counting a
repayment as both `--payment` and `--extra` slips in). Interest each period accrues only on
`max(balance − offset, 0)`. `--offset-contribution C` grows the offset every period.
`--offset-mode` picks the "paid off" definition: `loan` (default — the loan still amortizes to
zero, standard offset mortgage) or `net` (payoff when the offset catches the loan,
`balance ≤ offset`).

```bash
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 1798.65 --offset 50000
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 1798.65 \
    --offset 50000 --offset-contribution 500 --offset-mode net
```

**Variable rate** — `--rate-step PCT@PERIOD` (repeatable) applies a new annual rate from that
period onward; `--rate-band LOW,HIGH` adds a `sensitivity` block bracketing best/worst at two
flat rates. A rate path that stalls the loan errors with an amortization message (exit `2`).

```bash
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 2200 --rate-step 8@60
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 2200 --rate-band 5,8
```

**Schedule** — `--schedule` adds a per-period `schedule` array (opening/closing balance,
interest, principal, offset) for showing the trajectory, not just the aggregates.

```bash
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 1798.65 --schedule
```

### `compound` — future value with compounding

```bash
~/bin/agent_scripts/finance compound --principal 10000 --rate 5 --years 10
~/bin/agent_scripts/finance compound --principal 10000 --rate 5 --years 10 --n 12 --contribution 200
```

`result` = future value; also `total_contributions`, `interest_earned`. `--contribution` is a
recurring deposit per period; `--timing begin` for deposits at the start of each period.

### `fv` / `pv` — future & present value

```bash
~/bin/agent_scripts/finance fv --present-value 10000 --payment 200 --rate 5 --years 10
~/bin/agent_scripts/finance pv --future-value 16470.09 --rate 5 --years 10
```

`fv` is a thin framing over the compounding core; `pv` is its inverse (what a future sum is
worth today). Both take an optional `--payment` annuity and `--n`.

### `appreciate` — asset appreciation

```bash
~/bin/agent_scripts/finance appreciate --value 500000 --rate 4 --years 7
```

`result` = appreciated value; also `total_gain`, `total_gain_pct`. Defaults to annual
compounding (`--n 1`).

### `depreciate` — asset depreciation schedule

```bash
~/bin/agent_scripts/finance depreciate --cost 30000 --salvage 5000 --life 5 --method straight
~/bin/agent_scripts/finance depreciate --cost 30000 --salvage 5000 --life 5 --method declining --factor 2 --year 3
```

`result` = annual depreciation (straight-line) or book value at `--year` if given; always
includes the full per-year `schedule`. Declining-balance floors book value at salvage.

### `cagr` — compound annual growth rate

```bash
~/bin/agent_scripts/finance cagr --start 100 --end 200 --years 10
```

`result` = growth rate % — `(end/start)^(1/years) − 1`.

### `roi` — return on investment

```bash
~/bin/agent_scripts/finance roi --cost 1000 --final-value 1500 --years 3
```

`result` = ROI %; pass `--gain` instead of `--final-value` if you know the net profit. With
`--years` it also returns `annualized_roi_pct`.

### `pct-change` — percentage change

```bash
~/bin/agent_scripts/finance pct-change --from 80 --to 100
```

`result` = percentage change; also `absolute_change`.

### `ear` — effective annual rate

```bash
~/bin/agent_scripts/finance ear --rate 6 --n 12
```

`result` = effective annual rate % from a nominal rate compounded `--n` times/year (APR→EAR).

### `savings-goal` — required periodic contribution

```bash
~/bin/agent_scripts/finance savings-goal --target 100000 --rate 6 --years 10
```

`result` = contribution needed each period to reach `--target`; optional `--principal` for a
starting balance.

## When to Use / Not Use

Use it for any money math beyond a one-glance sanity check: repayments, payoff timelines,
compounding, present/future value, appreciation/depreciation, growth rates, ROI, rate
conversions, savings targets. When in doubt, use it — running the script is cheap; a wrong
financial figure is not.

Skip it only for a trivial single step you'd stake your reputation on (e.g. 10% of 200).

## Not This Script — Use These Instead

- **Raw arithmetic / expressions** (no financial formula) → `~/bin/agent_scripts/calculator`.
- **Currency / FX conversion** → `~/bin/agent_scripts/currency` (live + historical rates).
- **Import / landed cost** (VAT + import tax + FX) → `~/bin/agent_scripts/landed-cost`.

`finance` is unit-agnostic and does no FX — if amounts are in different currencies, convert
them with `currency` first, then feed single-currency numbers into `finance`.
