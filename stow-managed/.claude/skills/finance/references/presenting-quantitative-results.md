# Presenting Quantitative & Financial Results

How to present numbers you computed — in a chat reply or a written document — so the reader
leads with the answer, trusts the figures, and can see at a glance which conclusions rest on a
guess. Load this whenever `calculator` or `finance` output will be shown to the user as more
than a single figure: any comparison, scenario model, projection, or multi-step result.

The math being correct is necessary but not sufficient. A correct model presented in the order
you *computed* it is nearly unreadable; the reader has to reconstruct the conclusion themselves.
The job here is to present it in the order the reader *needs*.

## Contents

- The seven principles
- Canonical document skeleton (multi-scenario comparison)
- Inline-response variant (chat replies)
- Confidence tagging
- Named anti-patterns
- Checklist before you hand it over

## The seven principles

1. **Answer first (BLUF — bottom line up front).** The decision, the recommended outcome, and
   the two or three levers that move it go at the very top. Everything below is derivation the
   reader can descend into only if they want to. If the reader has to scroll to find the
   conclusion, the document is upside-down.

2. **Three separated layers: answer → model → audit trail.** Keep them distinct and in this
   order. The **answer** is what to conclude. The **model** is the inputs, assumptions, and
   building-block figures — one source of truth, each value derived exactly once. The **audit
   trail** is the `calculator`/`finance` invocations that prove each number; it lives at the
   bottom (an appendix or a collapsed block), never interleaved with the prose.

3. **Mark the confidence of every load-bearing number.** Distinguish *known* (a confirmed fact),
   *estimate* (a best guess), and *unknown* (not yet determined). A model that hinges on a
   guessed bonus should make that guess impossible to miss — the reader's trust in the
   conclusion should track the confidence of the inputs it rests on. See *Confidence tagging*.

4. **The live document holds only what is currently true.** No changelog, no "(was X)"
   annotations, no superseded numbers sitting next to live ones. Corrections belong in version
   history (git), not in the reader's way. A reader must never have to work out which of two
   numbers is the current one.

5. **Weight by magnitude.** A ±A$260k swing and a ±A$400 quirk should not look identical. Give
   the big levers prominence (ordering, bold, their own row); demote rounding-level items to a
   footnote or omit them. Convey weight through structure — placement, bold, ordering — not
   through emoji or color.

6. **State the unit convention once, then hold it.** Pick a primary unit (e.g. "all figures in
   AUD unless marked") and keep the reader in it. If a second currency or unit is unavoidable,
   give it its own labelled column rather than switching mid-sentence.

7. **"What would change the answer" is a first-class section**, not scattered caveats. Collect
   the swing factors, sensitivity ranges, and open questions in one place so the reader can see
   the model's fragility at a glance — especially the single factor that could flip the
   conclusion.

## Canonical document skeleton (multi-scenario comparison)

For a standalone document comparing scenarios, use this top-to-bottom order. It is a starting
skeleton, not a straitjacket — drop a section that doesn't apply, but don't reorder so the
answer sinks. Each section below names *why* it sits where it does.

1. **Title + one line** — the decision this answers, and an as-of date. (The reader needs to know
   what question is on the table and how fresh the numbers are before reading anything.)

2. **Bottom line / recommendation** — the answer in two or three sentences: the recommended
   outcome, the headline figure, and the two or three levers that move it. (This is the whole
   point of principle 1. Most readers should be able to stop here.)

3. **Scenarios at a glance** — one canonical comparison table. Columns: scenario, the headline
   figure, and a `vs baseline` delta. Order rows by magnitude or by the decision's logic, not by
   the order you computed them. Exactly one such table — not three near-duplicates.

4. **Certain vs assumed** — the load-bearing inputs, each tagged Known / Estimate / Unknown (a
   Confidence column). Put the guesses where they can't be missed; they carry the risk.

5. **The model** — the single source-of-truth building blocks (each derived figure stated once,
   with a one-line "where it comes from"), and the governing method or rule stated up front
   (e.g. "compare the same gross on both sides so the delta isolates the tax effect"). Every
   number in the tables above traces back to a building block here.

6. **What would change the answer** — sensitivities, ranges, and open questions. Lead with the
   biggest swing factor. This is where a reader stress-tests the recommendation.

7. **Appendix: audit trail** — the `calculator`/`finance` invocations that reproduce every
   building-block figure, in a collapsed `<details>` block or a clearly-labelled bottom section.
   Present so any figure can be re-run and checked, without cluttering the read.

A compact illustration of sections 2–3:

```markdown
## Bottom line
Moving nets ~A$73k/yr more than staying (+16%), driven almost entirely by the
15% HK tax cap vs 47% AU marginal on bonus income. The result flips negative only
if the 2027 bonus is taxed as AU-source — the one question worth resolving first.

## Scenarios at a glance
_All figures A$/yr, steady state._

| Scenario                | Cash available | vs staying       |
|-------------------------|---------------:|------------------|
| Stay                    |       448,538  | —                |
| Move + sell             |       521,928  | +73,390  (+16%)  |
| Move + keep & rent      |       497,975  | +49,437  (+11%)  |
```

## Inline-response variant (chat replies)

For a calculation shown in a chat reply rather than a written document, compress the same shape:

- **Lead with the answer** — the figure and what it means, in the first sentence.
- **Show the key numbers** in a small table or tight list, not a wall of prose.
- **Flag any guessed input's confidence** inline ("assuming a ~A$400k bonus, which is a guess").
- **Put the commands after the conclusion**, or in a collapsed block — never before it. The
  reader wants the answer first; the provenance is there if they want to verify.

The principle is identical to the document skeleton: answer, then model, then audit trail. Only
the weight of each layer shrinks.

## Confidence tagging

Make confidence visible without decoration. In an inputs/assumptions table, add a **Confidence**
column with one of three values:

- **Known** — a confirmed fact. Note the source ("payslip", "ATO 2025-26 schedule").
- **Estimate** — a best guess. State the basis and a rough range ("~A$400k, based on last
  year ±25%").
- **Unknown** — not yet determined. State when it will be known and model it separately or as a
  sensitivity, never silently folded into the headline figure.

Inline (in prose or a chat reply), a short parenthetical does the same job: "the 2027 bonus
(estimate — actual disclosed Jan 2027)". The reader should always be able to tell a load-bearing
guess from a fact.

## Named anti-patterns

These are the failure modes that make a numerically-correct document unreadable. Each maps to a
principle above.

- **Changelog in the live document** — "session 5 correction", "(was A$7.6k)", "superseded by
  item 6". Process residue forces the reader to track versions. It belongs in git. (Principle 4)
- **Superseded numbers left inline** — a dead figure sitting next to the live one. The reader
  can't tell which is current. Delete the old one. (Principle 4)
- **Commands as narrative** — raw `calculator '...' → N` invocations interleaved with the prose
  as if they were the story. They are provenance; move them to the audit trail. (Principle 2)
- **Equal weighting** — a ±A$400 quirk formatted like the ±A$260k headline. Weight by magnitude.
  (Principle 5)
- **Unmarked guesses** — a guessed bonus formatted identically to a known salary, so the reader
  over-trusts a conclusion that rests on a guess. (Principle 3)
- **Buried methodology** — the rule that makes the comparison valid introduced as a footnote or
  a changelog item instead of stated up front. (Principle 5 of the skeleton / model section)
- **Duplicated tables with drift** — the same scenarios computed two or three times with small
  differences, so the reader can't tell whether the differences are meaningful. Keep one
  canonical table per thing. (Principle 2)
- **Mixed units mid-flow** — switching between currencies or units without a stated convention.
  (Principle 6)
- **Flagged-but-unfixed inconsistency** — noting "these two rows aren't computed the same way"
  and leaving it. Either fix it, or if fixing changes a figure the user must approve, surface it
  loudly in "What would change the answer" — don't let an apples-to-oranges comparison sit in the
  headline table.

## Checklist before you hand it over

- [ ] The recommendation and the top scenarios are legible on the first screen, with no
      changelog or command block above them.
- [ ] Every load-bearing number is tagged Known / Estimate / Unknown.
- [ ] No superseded numbers or changelog in the live document.
- [ ] Script invocations are in the audit trail, not interleaved with the prose.
- [ ] Each scenario/sensitivity appears in exactly one canonical table.
- [ ] One unit convention, stated once and held.
- [ ] The biggest swing factor — the thing that could flip the answer — is called out explicitly.
- [ ] Every figure in the body traces to a building block; every building block has a command in
      the audit trail.
