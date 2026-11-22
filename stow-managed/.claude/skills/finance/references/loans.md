# Loans: `mortgage` and `payoff`

Conventions (percent `--rate`, JSON output, `--pay-freq`, `--dp`) are in SKILL.md.

## `mortgage` — amortized loan payment

```bash
~/bin/agent_scripts/finance mortgage --principal 300000 --rate 6 --years 30
```

`result` = payment per period; also `num_payments`, `total_paid`, `total_interest`. Add
`--pay-freq fortnightly` for accelerated schedules.

Need an offset account? `mortgage` has no offset — use `payoff --offset` instead, which
simulates the real payment schedule against the net balance.

## `payoff` — time to clear a balance

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

