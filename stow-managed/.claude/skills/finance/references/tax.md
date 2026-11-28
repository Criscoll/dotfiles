# Tax: `progressive-tax` and cross-currency chaining

## `progressive-tax` — tax across progressive brackets

```bash
~/bin/agent_scripts/finance progressive-tax --income 675000 \
  --bracket 18200:0 --bracket 45000:16 --bracket 135000:30 --bracket 190000:37 --bracket inf:45 \
  --surcharge 2
```

Repeatable `--bracket UPTO:RATE_PCT` (e.g. `45000:16`) gives the upper income threshold and
marginal rate for that bracket; the top bracket uses the literal `inf` (e.g. `inf:45`) and
must be last. Thresholds must be strictly ascending. `result` = total tax; also `base_tax`
(bracket tax before surcharge), `tax_by_bracket` (per-bracket slice/rate/tax breakdown),
`surcharge_amount`, `progressive_total`, `effective_rate_pct`. `--surcharge PCT` is an optional
flat percentage of income added on top (e.g. AU's Medicare Levy).

For two-method comparisons (progressive vs. a flat-rate alternative, taxed at
whichever is lower), add `--flat-rate PCT`: `result` becomes `min(progressive, flat)`, and the
output includes `methods: {progressive, flat}` plus `method_used`.

## Chaining with Other Scripts

For a cross-currency tax comparison, convert first with `currency`, then feed the converted
number straight into `finance` — don't hand-compute the FX step in `calculator`:

```bash
~/bin/agent_scripts/currency 675000 AUD HKD
# → take the converted amount and feed it into progressive-tax
~/bin/agent_scripts/finance progressive-tax --income <converted_amount> \
  --bracket 50000:2 --bracket 100000:6 --bracket 150000:10 --bracket 200000:14 --bracket inf:17
```
