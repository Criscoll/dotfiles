# Growth and value: `compound`, `fv`/`pv`, `appreciate`, `real`, `depreciate`, `savings-goal`

## `compound` — future value with compounding

```bash
~/bin/agent_scripts/finance compound --principal 10000 --rate 5 --years 10
~/bin/agent_scripts/finance compound --principal 10000 --rate 5 --years 10 --n 12 --contribution 200
```

`result` = future value; also `total_contributions`, `interest_earned`. `--contribution` is a
recurring deposit per period; `--timing begin` for deposits at the start of each period.

Add `--inflation PCT` to deflate the headline future value into today's money — every
projection above is nominal by default and silently overstates the real outcome at longer
horizons or higher rates. Adds `inflation_pct`, `real_future_value`, and `real_interest`.

## `fv` / `pv` — future & present value

```bash
~/bin/agent_scripts/finance fv --present-value 10000 --payment 200 --rate 5 --years 10
~/bin/agent_scripts/finance pv --future-value 16470.09 --rate 5 --years 10
```

`fv` is a thin framing over the compounding core; `pv` is its inverse (what a future sum is
worth today). Both take an optional `--payment` annuity and `--n`. `fv` also takes
`--inflation PCT` (see `compound` above) to add `real_future_value`.

## `appreciate` — asset appreciation

```bash
~/bin/agent_scripts/finance appreciate --value 500000 --rate 4 --years 7
```

`result` = appreciated value; also `total_gain`, `total_gain_pct`. Defaults to annual
compounding (`--n 1`). Add `--inflation PCT` for `real_final_value` and `real_gain`.

## `real` — inflation-adjusted value or rate

Two modes, picked by which inputs you give — `--inflation PCT` is required either way.

Deflation mode: what a future nominal amount is worth in today's money.

```bash
~/bin/agent_scripts/finance real --amount 100000 --inflation 3 --years 20
```

`result`/`real_value` = the deflated amount; also `purchasing_power_pct` (how much of the
original buying power survives) and `purchasing_power_lost`.

Real-rate mode (Fisher equation): the inflation-adjusted version of a nominal rate — omit
`--amount`/`--years`, pass `--rate` instead.

```bash
~/bin/agent_scripts/finance real --rate 7 --inflation 3
```

`result`/`real_rate_pct` = `((1+rate)/(1+inflation) − 1)`. Use this to sanity-check whether a
quoted investment/loan rate actually beats inflation.

## `depreciate` — asset depreciation schedule

```bash
~/bin/agent_scripts/finance depreciate --cost 30000 --salvage 5000 --life 5 --method straight
~/bin/agent_scripts/finance depreciate --cost 30000 --salvage 5000 --life 5 --method declining --factor 2 --year 3
```

`result` = annual depreciation (straight-line) or book value at `--year` if given; always
includes the full per-year `schedule`. Declining-balance floors book value at salvage.

## `savings-goal` — required periodic contribution

```bash
~/bin/agent_scripts/finance savings-goal --target 100000 --rate 6 --years 10
```

`result` = contribution needed each period to reach `--target`; optional `--principal` for a
starting balance.

