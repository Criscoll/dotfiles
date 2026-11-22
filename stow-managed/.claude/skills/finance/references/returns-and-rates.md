# Returns and rates: `cagr`, `roi`, `npv`, `irr`, `pct-change`, `ear`

## `cagr` — compound annual growth rate

```bash
~/bin/agent_scripts/finance cagr --start 100 --end 200 --years 10
```

`result` = growth rate % — `(end/start)^(1/years) − 1`.

## `roi` — return on investment

```bash
~/bin/agent_scripts/finance roi --cost 1000 --final-value 1500 --years 3
```

`result` = ROI %; pass `--gain` instead of `--final-value` if you know the net profit. With
`--years` it also returns `annualized_roi_pct`.

`roi`/`cagr` assume a single start→end value at even timing. For irregular, dated cashflows
(an investment property, a lump-sum-vs-payments offer, signing bonuses/vesting), use `npv`/`irr`
instead.

## `npv` — net present value of a cashflow stream

Repeatable `--cashflow AMT@PERIOD`: period `0` = today, negative = outflow, positive = inflow.
`--n` sets cashflow periods per year (default `1` = annual); `--rate` is the annual discount
rate, applied at the per-period rate `rate/n`.

```bash
~/bin/agent_scripts/finance npv --rate 8 \
  --cashflow -10000@0 --cashflow 3000@1 --cashflow 3000@2 --cashflow 3000@3 --cashflow 3000@4
```

`result`/`npv` = sum of discounted cashflows; also `sum_undiscounted`, `num_cashflows`. Negative
`npv` means the stream doesn't clear the discount rate; positive means it beats it.

## `irr` — internal rate of return of a cashflow stream

Same `--cashflow AMT@PERIOD` / `--n` inputs as `npv` (no `--rate` — IRR solves for it). Needs
at least one outflow and one inflow among the cashflows.

```bash
~/bin/agent_scripts/finance irr \
  --cashflow -10000@0 --cashflow 3000@1 --cashflow 3000@2 --cashflow 3000@3 --cashflow 3000@4
```

`result`/`irr_pct` = the annualized rate that zeroes NPV; also `npv_at_irr` (≈0, a sanity
check) and `irr_period_pct` when `--n` isn't `1`. All-positive or all-negative cashflow streams
error (exit `2`) — IRR is undefined without both a cost and a return.

## `pct-change` — percentage change

```bash
~/bin/agent_scripts/finance pct-change --from 80 --to 100
```

`result` = percentage change; also `absolute_change`.

## `ear` — effective annual rate

```bash
~/bin/agent_scripts/finance ear --rate 6 --n 12
```

`result` = effective annual rate % from a nominal rate compounded `--n` times/year (APR→EAR).

