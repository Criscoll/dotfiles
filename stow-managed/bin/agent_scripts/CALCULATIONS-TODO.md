# Calculation Scripts — Roadmap

A library of small, deterministic calculation scripts the agent reaches for instead of
doing math in its head. Each is one focused, single-purpose executable following the
house pattern (`currency`, `landed-cost` are the reference implementations):

- extensionless, `#!/usr/bin/env -S uv run --script` shebang, PEP 723 metadata block
- **stdlib only where possible** (`dependencies = []`) — the whole point is exact, offline,
  reproducible results
- `argparse`, JSON to stdout with the primary answer under a `"result"` key, errors to
  stderr with a non-zero exit code
- referenced by full path (`~/bin/agent_scripts/<name>`); usable immediately without
  re-running stow because `~/bin/agent_scripts/` is a directory symlink into this repo

## Built

- **`calculator`** — safe arithmetic/math expression evaluator (`calculator '2**64 - 1'`).
  Strict AST allow-list, no builtin `eval`. Surfaced to the agent via the `calculator` skill.

- **`finance`** — deterministic time-value-of-money math via git-style subcommands
  (`finance mortgage --principal 300000 --rate 6 --years 30`). Covers `mortgage`, `payoff`
  (payment or income−expenses mode, exact month-by-month simulation with extra/lump payments),
  `compound`, `pv`, `fv`, `appreciate`, `depreciate`, `cagr`, `roi`, `pct-change`, `ear`,
  `savings-goal`, `progressive-tax` (bracket-based tax with optional flat-rate surcharge and
  flat-rate alternative comparison). Float TVM core, money rounded to cents half-up via
  `decimal`. Currency-agnostic (no FX). Surfaced to the agent via the `finance` skill.

## Planned (not yet built)

Each is a candidate for its own script. Build when the need first comes up; keep them
single-purpose rather than folding them into `calculator`.

- **`stats`** — descriptive statistics over a list of numbers (stdlib `statistics`).
  Sketch: `stats 1 2 3 4 5` or `stats --data 1,2,3` → count, sum, min, max, range, mean,
  median, mode (when defined), sample stdev/variance, population pstdev/pvariance, quartiles.

- **`unit-convert`** — offline unit conversion via static factor tables, no network
  (stdlib only). Sketch: `unit-convert 100 km mi`, `unit-convert 32 F C`. Categories:
  length, mass, temperature (offset-aware — not a plain factor), volume, area, speed,
  data (SI + IEC), time. Auto-detect category from the units; error clearly if `FROM`/`TO`
  are in different categories. **No currency** — that is already covered (see below).

- **`date-calc`** — date arithmetic (stdlib `datetime`). Sketch: `date-calc diff A B`
  (days/weeks between + weekday of each), `date-calc add DATE --days N [--weeks N]`
  (subtract via negatives), `date-calc weekday DATE`.

## Already covered — do NOT duplicate

- **Currency / FX conversion** → `~/bin/agent_scripts/currency` (live rates, historical dates).
- **Import / landed cost** (VAT removal + import tax + FX) → `~/bin/agent_scripts/landed-cost`.

The planned `unit-convert` is units only and must not touch currency; defer all FX to the
two scripts above.
