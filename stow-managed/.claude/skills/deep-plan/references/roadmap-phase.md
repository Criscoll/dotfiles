## Roadmap phase

The point of Roadmap is to break a large goal into a terse, ordered list of high-level items a fresh agent can work through one at a time. **Keep it terse and high-level** — a title plus a line of intent per item. Detail is deliberately deferred: each item gets its own REQUIREMENTS.md when its turn comes. Do not pre-plan the items here.

0. **No prompt given — guide the user.** If `$ARGUMENTS` is empty and no `ROADMAP.md` exists, the user invoked deep-plan without specifying what they want to plan. Do not decompose an empty goal. Instead, ask the user to describe what they're trying to achieve:

   > I see you've invoked deep-plan without a task description and there's no existing Roadmap. Let's scope what you're working on. What's the goal or problem you want to plan for?

   Let the user respond in their own words. Ask follow-up questions as needed — what problem they're solving, what constraints or context exist, what a successful outcome looks like. Once they've described the goal, restate it in one sentence to confirm shared understanding, then move into step 1. **Do not decompose the goal until the user has confirmed your restatement.**

1. **Restate** the overall goal in one sentence. If the restatement feels wrong or the goal is ambiguous, stop and ask — do not decompose around a guessed interpretation.

2. **Validate enough to slice.** Read the relevant code and docs (CLAUDE.md, README, repo structure) at the depth needed to cut sensible slices — not the deep per-component dive Refine does. You're answering: *what are the natural vertical slices of this goal, and in what order?*

3. **Decompose into vertical slices.** Each item should deliver something visible and testable on its own — avoid "infrastructure-only" items that produce nothing a user can see. Order them so each builds on the last. Prefer few items over many. If the goal genuinely is one slice, a single item is correct.

4. **Write `ROADMAP.md`** — terse, the durable tracker for the whole build. Tell the user the path once written. Structure:

```
# Roadmap: <overall goal>

## Goal
One or two sentences — the end state when every item is done.

## Items
Ordered, high-level vertical slices. Each delivers something visible/testable.
Terse — a title plus a one-line intent. NO technical detail; that lives in each
item's REQUIREMENTS.md when its turn comes.
- [ ] 1. <title> — <one-line intent / need>
- [ ] 2. <title> — <one-line intent / need>

## Out of Scope
What the build as a whole does NOT cover.
```

5. **Annotation cycle on `ROADMAP.md`.** Hand control back with this invitation:

   > ROADMAP.md is written at `<path>`. Open it and add inline notes anywhere you want changes — prefix each note with `//` (like a code comment) so I can find them: reorder items, drop or merge slices, add a missing one, retitle. Then tell me "address my notes" and I'll update it. **I won't refine, plan, or implement anything until you explicitly approve.**

   When the user says they've annotated: re-read the file from disk (they edited it — don't trust your in-context copy), **scan for `//`-prefixed notes**, address every one in place, clear the `//` markers once resolved, report what changed, and return to the gate. Repeat as many rounds as the user wants.

6. **Gate → handoff to Refine.** When the user approves, do NOT roll into Refine. Tell them plainly:

   > Roadmap approved. Run `/clear` to start a fresh session, then invoke `/deep-plan` again — it will detect ROADMAP.md and enter the Refine phase for the first item.

   If the artifacts live outside the repo (user specified a custom path), remind them to re-invoke from the same working directory or pass the path again so the next phase resolves the same artifact directory.
