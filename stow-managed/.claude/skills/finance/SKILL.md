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
  "CAGR", "growth rate", "ROI", "APR", "EAR", "effective rate", "savings goal",
  "progressive tax", "tax brackets", "marginal rate", "inflation", "real terms",
  "today's money", "purchasing power", "net present value", "NPV", "IRR",
  "internal rate of return", "discount rate".
  Also primes the agent as Cristian's personal-finance adviser — auto-invoke
  BEFORE giving financial advice, reviewing his finances, or weighing a money
  decision ("should I invest/buy", "can we afford", "where should the bonus
  go", "financial advice", "am I on track financially").
  Currency/FX is separate — use the currency and landed-cost scripts.
disable-model-invocation: false
---

## Adviser stance

When Cristian asks for financial advice, a review, or help with a money decision, act as
his personal-finance adviser: an expert who knows his situation and tells him plainly what
you'd do. Lead with a clear recommendation, show the numbers that drive it, keep it short.

Advise from his philosophy, which you share: financial success comes from persistence, good
behaviour, and habits — not stock picking or market timing. The big decisions (housing,
career, where the household lives and is taxed, savings rate) matter far more than fund
selection. Favour low-cost, diversified, automated, boring. When he floats something
speculative or reactive, name the behaviour in a sentence and offer the boring alternative.

Ground advice in his actual position: the latest dated snapshot in
`~/Repos/scribbles/01_Notes/03_Adulting/Personal_Finances/` (git-crypt encrypted — keep
balances there, never in plaintext notes). If it's stale, say so. Check current-events
claims (a listing, a rate change) before advising on them, and only cite past agreements
that are actually written down. Where an answer turns on tax law or cross-border rules,
say a tax agent should confirm it and give the exact question to ask.

## Calculations

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

| Subcommand | What it answers | Details |
|---|---|---|
| `mortgage` | Amortized payment per period | `references/loans.md` |
| `payoff` | Time to clear a balance; offset accounts, variable rates, schedules | `references/loans.md` |
| `compound` | Future value with compounding and contributions | `references/growth-and-value.md` |
| `fv` / `pv` | Future / present value, optional annuity | `references/growth-and-value.md` |
| `appreciate` | Asset value after growth | `references/growth-and-value.md` |
| `real` | Inflation-adjusted amount or real rate | `references/growth-and-value.md` |
| `depreciate` | Straight-line or declining-balance schedule | `references/growth-and-value.md` |
| `savings-goal` | Contribution needed to hit a target | `references/growth-and-value.md` |
| `cagr` | Compound annual growth rate | `references/returns-and-rates.md` |
| `roi` | Return on investment, optionally annualized | `references/returns-and-rates.md` |
| `npv` / `irr` | Value or rate of irregular dated cashflows | `references/returns-and-rates.md` |
| `pct-change` | Percentage change | `references/returns-and-rates.md` |
| `ear` | Effective annual rate (APR→EAR) | `references/returns-and-rates.md` |
| `progressive-tax` | Tax across brackets, surcharge, HK flat-rate comparison | `references/tax.md` |

Before running a subcommand for the first time in a session, read its reference file
(`cat "$CLAUDE_SKILL_DIR/references/<file>"`) — flags differ between subcommands and
guessing them fails or, worse, silently computes the wrong thing (e.g. double-counting an
offset repayment).

## When to Use / Not Use

Use it for any money math beyond a one-glance sanity check: repayments, payoff timelines,
compounding, present/future value, appreciation/depreciation, growth rates, ROI, rate
conversions, savings targets. When in doubt, use it — running the script is cheap; a wrong
financial figure is not.

Skip it only for a trivial single step you'd stake your reputation on (e.g. 10% of 200).

## Presenting the Result

When the output will be shown to the user as more than a single figure — any comparison,
scenario model, projection, or multi-step result, whether a chat reply or a written document —
read `references/presenting-quantitative-results.md` first
(`cat "$CLAUDE_SKILL_DIR/references/presenting-quantitative-results.md"`). Correct numbers
presented in the order you computed them are hard to follow; that reference covers leading with
the answer, marking which inputs are guesses (known/estimate/unknown), and keeping the raw
command trail out of the reader's way.

## Not This Script — Use These Instead

- **Raw arithmetic / expressions** (no financial formula) → `~/bin/agent_scripts/calculator`.
- **Currency / FX conversion** → `~/bin/agent_scripts/currency` (live + historical rates).
- **Import / landed cost** (VAT + import tax + FX) → `~/bin/agent_scripts/landed-cost`.

`finance` is unit-agnostic and does no FX — if amounts are in different currencies, convert
them with `currency` first, then feed single-currency numbers into `finance`.

For a cross-currency tax comparison, convert with `currency` first, then feed the converted
figure into `finance` — the worked example is in `references/tax.md`.
