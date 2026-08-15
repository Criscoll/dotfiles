---
name: calculator
description: >-
  Evaluate arithmetic and math expressions exactly with the deterministic
  `~/bin/agent_scripts/calculator` script instead of computing in your head — LLM
  mental math is unreliable and non-repeatable. Auto-invoke BEFORE doing any
  non-trivial, multi-step, or precision-sensitive calculation: large numbers,
  powers/roots, factorials, logs/trig, chained operations, order-of-operations
  expressions, or anything where a wrong digit matters — even if the user did not
  explicitly ask for a tool. Trigger phrases: "calculate", "compute", "what's X
  times/plus/divided by Y", "work out", "how much is", "evaluate this expression",
  "to the power of", "square root of", "factorial", "log of", "percentage of",
  "sum of these numbers". Do NOT trigger for trivial single-operation mental math
  (e.g. 2+2). Currency conversion is separate — use the currency/landed-cost scripts.
disable-model-invocation: false
---

Do non-trivial arithmetic with `~/bin/agent_scripts/calculator`, never in your head.
It evaluates one expression exactly (arbitrary-precision integers, full float math) via a
strict, safe AST walk — so the result is deterministic, repeatable, and auditable. This is
the whole reason to prefer it: an LLM computing multi-step arithmetic mentally is guessing.

## Script Check — Do This First

`calculator` lives in `agent_scripts/` and is deliberately not on `$PATH`. Call by full path:

```bash
ls ~/bin/agent_scripts/calculator
```

If missing, stow from the dotfiles repo hasn't been run or the file wasn't created. Do not
fall back to computing the answer yourself — surface the problem instead.

## Usage

Pass the expression as one quoted argument (single-quote it so the shell leaves `*`, `(`, `)`
alone):

```bash
~/bin/agent_scripts/calculator '2**10 + sqrt(144)'
~/bin/agent_scripts/calculator '2**64 - 1'
~/bin/agent_scripts/calculator 'factorial(20)'
~/bin/agent_scripts/calculator '(1250 * 1.1) / 3'
~/bin/agent_scripts/calculator 'sum([19.99, 4.50, 120, 8.75])'
~/bin/agent_scripts/calculator 'log2(1024)'
```

Output is JSON on stdout; the answer is under `"result"`:

```json
{
  "expression": "2**64 - 1",
  "result": 18446744073709551615
}
```

Errors (bad syntax, disallowed names, division by zero, math domain errors) print to stderr
and exit non-zero (`2`) — read the message rather than retrying blindly.

## What's Allowed

- **Operators:** `+ - * / // % **`, unary `+/-`, and comparisons (`< <= > >= == !=`, chainable).
- **Functions:** `sqrt sin cos tan asin acos atan atan2 sinh cosh tanh log log2 log10 exp
  floor ceil factorial comb perm gcd lcm hypot degrees radians copysign fabs trunc` plus
  `abs round min max sum pow int float divmod`.
- **Constants:** `pi e tau inf nan`.
- **Literals:** numbers, and list/tuple literals (so `sum([1,2,3])` / `min((4,5,6))` work).

Nothing else. Names outside this set, attribute access, and `__import__` are rejected — that
allow-list is the security boundary, so don't expect string ops or variable assignment.

## When to Use / Not Use

Use it for anything you'd otherwise risk getting wrong:
- Large numbers, powers, roots, factorials, logs, trig
- Chained / order-of-operations expressions where precedence matters
- Any precision-sensitive result (money totals, percentages of exact figures)

Skip it only for genuine one-glance sanity checks (single-digit `2+2`). When in doubt, use it —
loading and running the script is cheap; a wrong number is not.

## Not This Script — Use These Instead

- **Currency / FX conversion** → `~/bin/agent_scripts/currency` (live + historical rates).
- **Import / landed cost** (VAT + import tax + FX) → `~/bin/agent_scripts/landed-cost`.

`calculator` is pure arithmetic — it has no unit or currency awareness.

## Future Calculation Scripts

This script is the first of a planned library of small, deterministic calculation tools
(descriptive `stats`, offline `unit-convert`, `date-calc`, `finance`). They are documented but
not yet built — see `~/bin/agent_scripts/CALCULATIONS-TODO.md`. If one of those needs comes up
and the script doesn't exist yet, tell the user rather than silently doing the math by hand.
