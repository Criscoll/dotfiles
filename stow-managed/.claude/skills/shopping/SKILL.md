---
name: shopping
description: >-
  Purchase research and price comparison for overseas buying, with exact currency
  conversion and landed-cost calculation. Home market is AUD/Australia. Use for:
  "how much would it cost", "price in AUD", "factoring in shipping", "landed cost",
  "cheapest place to buy", "buy from overseas", "convert this price", "shipping to
  Australia", "compare prices", "import cost", "is it cheaper to". Not for managing
  grocery/to-do shopping lists.
disable-model-invocation: false
---

## Rule 1 — Get exact rates, never guess

Use `~/bin/agent_scripts/currency` for all currency conversion. Never run web
searches for exchange rates or hard-code approximations — the log that prompted
this skill did exactly that (three separate searches, results marked "est.").

```bash
# Single target (defaults to AUD)
~/bin/agent_scripts/currency 100 USD

# Multiple targets in one call
~/bin/agent_scripts/currency 100 USD AUD GBP EUR

# Historical rate pinned to a date
~/bin/agent_scripts/currency --date 2026-06-24 100 GBP AUD
```

Output is JSON on stdout: `amount`, `base`, `date`, `source`, `conversions[]`.
The `source` field tells you whether Frankfurter (ECB, ~30 currencies) or
open.er-api (160+ currencies) was used.

## Rule 2 — Compute totals with `landed-cost`, not by hand

Use `~/bin/agent_scripts/landed-cost` whenever you need a cross-currency total
that includes shipping, VAT removal, or import tax. Don't do the arithmetic
manually — the log did mixed-rate math that produced inconsistent "(est.)" rows.

```bash
# Basic: item (GBP) + shipping (AUD) → total AUD
~/bin/agent_scripts/landed-cost --item 15.98:GBP --shipping 28.80:AUD

# EU/UK seller: remove export VAT from item before converting
~/bin/agent_scripts/landed-cost --item 81.67:GBP --ex-vat --shipping 28.80:AUD

# With AU GST (10%) on item+shipping
~/bin/agent_scripts/landed-cost --item 115:EUR --shipping 14:EUR --import-tax 10

# Pin to a specific date for consistent rates
~/bin/agent_scripts/landed-cost --item 49.85:USD --shipping 26.84:USD --date 2026-06-24

# Custom VAT% or target currency
~/bin/agent_scripts/landed-cost --item 80:EUR --vat-removed 19 --to USD
```

Output is JSON: `breakdown` (item, vat_adjustment, shipping, import_tax all in
target currency), `total`, `rates_used`. One Frankfurter call covers all source
currencies, so all components share a single consistent rate set.

Both scripts default to AUD as the target currency and assume Australia as the
home market.

## Rule 3 — Gather vendor and shipping data

1. Use the **web-search** skill to find vendors/products and surface shipping pages.
2. Use the **web-crawl** skill to fetch product pages, shipping policy pages, and
   cart/checkout pages for actual prices and shipping costs.

See `references/shipping-and-tax.md` for common shipping page paths, VAT removal
details, AU GST rules, and URL currency-switcher tricks.

## Rule 4 — Present a comparison table

Sort rows by total AUD (ascending). Include one source citation per row. Explicitly
mark each figure as **confirmed** (directly from a page/checkout) or **estimated**
(inferred or converted from a displayed price).

| Vendor | Item (source) | Shipping (source) | Total AUD | Notes |
|--------|--------------|-------------------|-----------|-------|
| Example | £15.98 | A$28.80 | A$59.01 (confirmed) | VAT already ex-UK |

Flag any figure that is estimated and explain why (e.g. "shipping estimated from
their standard AUS rate table").
