# Shipping, VAT, and Import Tax Playbook

Reference for the **shopping** skill. Covers the gotchas discovered during a
tin-whistle price-comparison session so they don't need re-deriving each time.

---

## Finding shipping costs

Try these paths on a vendor's domain in order; stop when one works:

1. `/shipping`
2. `/delivery`
3. `/shipping-policy`
4. `/delivery-faqs`
5. `/shipping-returns-policy`
6. `/help/shipping` or `/support/shipping`

If none exist, check the cart/checkout flow — shipping is often calculated only
there. Add a test item and proceed to the shipping step without completing purchase.

---

## Currency-switcher URL parameters

Some stores display prices in your currency natively if you pass a parameter:

- `?currency=AUD` — Shush Music and similar indie shops
- `?currency=USD` — common on Shopify stores

Try appending `?currency=AUD` to the product URL before crawling — gets you native
AUD pricing without a manual conversion. If it works, the page price is confirmed
and you can pass it directly to `landed-cost --item PRICE:AUD`.

---

## VAT removal on EU/UK exports

EU and UK stores typically display prices **inclusive of VAT** (20% UK, 19–25% EU
depending on country). For orders shipped outside the EU/UK, VAT is removed at
checkout — the displayed price overstates what you'll actually pay.

**Always use `--ex-vat` when:**
- The store is UK-based and ships to Australia
- The store is EU-based and ships to Australia
- The product page shows a price without an explicit "ex-VAT" label

**`--ex-vat` assumes 20% UK VAT.** For EU stores where the rate differs:
```bash
# German store (19% VAT)
~/bin/agent_scripts/landed-cost --item 80:EUR --vat-removed 19 --shipping 12:EUR

# Swedish store (25% VAT)
~/bin/agent_scripts/landed-cost --item 100:SEK --vat-removed 25 --shipping 10:EUR
```

**Verification:** Some stores show both the inc-VAT and ex-VAT price during
checkout. If you can reach the checkout without completing purchase, use the
ex-VAT figure from there rather than computing it.

**Exception:** Some stores already strip VAT from the displayed price for
non-EU/UK visitors (geo-IP detection). If you see "ex VAT" or "excl. tax" on
the product page, do NOT apply `--ex-vat` again — the price is already clean.

---

## AU GST on imports

Australia levies **10% GST** on imported goods and services. The Low Value Imports
(LVI) scheme requires overseas sellers to collect GST on orders under A$1000 if
they exceed A$75k/year in AU revenue — large stores often do; small/indie stores
often don't.

**Practice:** Apply `--import-tax 10` for purchases from large overseas retailers.
For small indie sellers, note it as a potential additional cost but don't assume it
will be charged.

```bash
# Large retailer — assume GST
~/bin/agent_scripts/landed-cost --item 49.85:USD --shipping 26.84:USD --import-tax 10

# Small indie — GST uncertain
~/bin/agent_scripts/landed-cost --item 15.98:GBP --shipping 28.80:AUD
# → note in output: "GST not applied (small seller, threshold uncertain)"
```

---

## eBay listings

eBay lists item price and shipping separately. Be careful:

- **Item price** includes seller-collected GST if the seller is GST-registered —
  don't double-apply `--import-tax 10`.
- **Shipping** is shown separately; use that directly.
- eBay AU listings are in AUD — no conversion needed.
- eBay US listings: add `--ex-vat`? No — the US has no VAT. But check if the
  seller is in the US or drop-shipping from elsewhere.

---

## Marketplace / small-seller lead times

Small sellers (Etsy, individual eBay accounts, indie music shops) often have
long lead times not shown on the product page. From the shopping session:

> Mellow Dog Music (eBay): item in stock but "4–6 week" estimated delivery noted
> in seller feedback. Surface this when comparing against in-stock options.

Always check:
- **Estimated delivery date** shown on listing (eBay, Etsy show this prominently)
- **Seller feedback** comments mentioning dispatch times
- **Stock status** — "ships in X days" vs "in stock"

---

## Delivery time extraction

When crawling a vendor page, look for:

- "Ships within X days / business days"
- "Estimated delivery: [date range]"
- "Express / Standard / Economy" shipping tiers with days listed
- "Currently in stock" vs "backordered / pre-order"

Include delivery time in the comparison table if it varies significantly between
vendors (e.g. in-stock vs 6-week wait).
