# Generic Scenario Comparison for `finance`

## Context

A relocation/tax analysis session ran three scenarios (e.g. "stay", "relocate to HK", "relocate
to AU") through the `finance` script that shared roughly 70% of their inputs (same income,
same mortgage terms, same savings rate) and differed only in a handful of fields (tax brackets,
currency, cost of living). There was no way to express "run this base case three times with
these overrides" — each scenario had to be invoked separately and the results tracked and
cross-checked by hand, which is exactly the kind of manual bookkeeping `finance` exists to
eliminate.

## Problem

`finance` subcommands take a flat set of flags per invocation. Comparing N scenarios that share
most of their inputs currently means either:
- re-typing the full flag set N times (error-prone — a shared input can drift between
  invocations without anyone noticing), or
- running once and manually diffing/tracking results outside the tool.

There is exactly one precedent for bundling multiple runs into one output:
`payoff --rate-band LOW,HIGH` (`finance:250-281,374-379`), which re-runs the same base inputs
through `_band_run()` at two flat rates and nests both results under a `sensitivity` key. That
pattern generalizes, but only for a single numeric axis (rate) on one subcommand.

## Proposed Design

Add a generic, repeatable `--scenario NAME:key=val,key2=val2` flag to the shared `common`
parser (`finance:671-673`), so every subcommand gets it for free:

```bash
~/bin/agent_scripts/finance payoff --balance 300000 --rate 6 --payment 1800 \
  --scenario "stay:rate=6" \
  --scenario "relocate_hk:rate=5.5,payment=2000" \
  --scenario "relocate_au:rate=6.5,extra=200"
```

Mechanism:
1. Parse the base args normally (as today).
2. For each `--scenario NAME:key=val,...`, take the *original argv*, strip the `--scenario`
   flags, and re-append `--key val` for each override in that scenario's clause (falling back
   to the base value for anything not overridden).
3. Re-run `parser.parse_args()` on the reconstructed argv per scenario, then call the same
   `cmd_<name>` handler used for the base run.
4. Bundle results under a `scenarios` key: `{"stay": {...}, "relocate_hk": {...}, ...}`,
   alongside the base (unscenario'd) result under the existing top-level keys — mirroring how
   `sensitivity` sits alongside the base `payoff` result today.

This reuses argv re-parsing rather than hand-rolling a second args object, so every subcommand's
existing validation (`_die` calls, required-flag checks) runs unchanged for each scenario.

## Known Limitation

Overrides are scalar `key=val` only. Flags that are already repeatable (`--lump AMT@PERIOD`,
`--rate-step PCT@PERIOD`, `--bracket UPTO:RATE_PCT`) can't be overridden per-scenario without a
nested list syntax inside the comma-separated clause (e.g. `key=val;val2` to re-introduce a
repeated flag) — that's extra parsing complexity this design defers. A first version would
either reject scenario overrides that target a repeatable flag, or require repeatable-flag
scenarios to omit `--scenario` and stay as separate invocations.

## Why Deferred

The `--scenario` flag would live on the shared `common` parser, so its argv-reparsing logic is
cross-cutting: a bug there risks silently breaking every one of the 11+ existing subcommands
(mortgage, payoff, compound, pv, fv, appreciate, depreciate, cagr, roi, pct-change, ear,
savings-goal, progressive-tax), not just the one being extended. That risk was judged too broad
for a change bundled with the smaller, lower-risk progressive-tax addition — confirmed with the
user to scope that change down and defer this to its own pass, implemented and tested in
isolation with its own verification pass against every subcommand.

## Next Steps

1. Prototype the argv reconstruction + re-parse against `payoff` only (highest-value target —
   most flags, most likely to be scenario-compared).
2. Verify base-case output is byte-identical whether or not `--scenario` is passed (no
   regression on the non-scenario path).
3. Decide the repeatable-flag override syntax (or the explicit rejection message) before
   rolling out to other subcommands.
4. Extend to all subcommands via the shared `common` parser once the `payoff` prototype is
   solid, updating `SKILL.md` with one example per subcommand family.
