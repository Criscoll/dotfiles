# Description and Triggers — making the skill fire

The `description` is the only text the model reads when deciding whether to invoke
the skill. A weak description means the skill silently never fires, no matter how
good its body is. Agents *undertrigger* — they skip a skill unless the match is
obvious — so the description must be deliberately pushy.

## The three parts (recap)

The SKILL.md inline section covers the core shape: **what** the skill does, **when**
to auto-invoke (`Auto-invoke BEFORE…`), and **trigger phrases** (observable
artifacts — file extensions, command names, keywords). This file goes deeper.

## Deeper rules

- **Imperative beats passive.** "Auto-invoke BEFORE writing any Python code" fires
  more reliably than "use when working with Python" or "triggers on Python". Phrase
  the when-clause as a command.
- **List artifacts, not intent.** The model matches on what it can observe in the
  prompt or context (`.py`, `uv run`, `pyproject.toml`), not on inferred goals.
  Enumerate the surface signals.
- **One sentence.** The description sits in the always-loaded system-reminder index;
  keep it to a single line so it isn't truncated.
- **Err toward over-triggering.** Loading an irrelevant skill costs a few hundred
  tokens. *Not* loading a relevant one means the agent improvises and gets it wrong.
  When unsure whether a trigger belongs, include it.
- **"Even if they don't explicitly say X."** Use this pattern to catch valid-but-
  indirect cases — e.g. a code-review skill should fire after a chunk of work even if
  the user never types "review".

## Auto-invoke vs explicit-only

Two modes — pick deliberately:

- **Auto-invoke** (most skills): include the `Auto-invoke BEFORE…` clause plus trigger
  phrases. The skill fires on observed context without the user naming it.
- **Explicit-only**: for skills that should fire *only* on direct request (because
  auto-firing would be noisy or surprising — e.g. a commit-splitter, a session-notes
  sync). Omit the auto-invoke clause and use only `Use when the user says "…"` with
  the exact phrases. This is the current `skill-author` mode: it fires on "create a
  skill" / "update skill X", not on every file edit.

## Trigger-accuracy test (highest-leverage check)

Per the best-practices doc, this is "the single highest-leverage improvement
possible." A description can read well and still mis-fire; only evaluation tells you.

1. Write **20 queries**: 10 that *should* trigger the skill, 10 that *should not*
   (including near-misses — phrasings about an adjacent topic that must NOT fire).
2. For each, judge whether the current description would cause the model to invoke
   the skill. Run uncertain ones across a few fresh sessions, since triggering is
   probabilistic.
3. Score accuracy = (correct fires + correct skips) / 20. **Below 80%, rewrite the
   description and re-test.** Under-firing → add trigger phrases / a pushier
   when-clause. Over-firing on the no-trigger set → tighten the artifacts so they
   stop matching the adjacent topic.

Example split for a hypothetical `python-knowledge` skill:
- Should fire: "fix this .py file", "set up a pyproject", "uv add requests", "why does
  mypy fail here", "write a pytest".
- Should NOT fire: "format this JSON", "review my Dockerfile", "what's a good bash
  loop", "edit the README", "debug this TypeScript".

Run the test whenever you write a new description or substantially revise triggers.
