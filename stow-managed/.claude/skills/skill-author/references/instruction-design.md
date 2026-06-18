# Instruction Design — writing the SKILL.md body

How to phrase the instructions in a skill so the model follows them reliably and
generalizes correctly. The body is loaded only when the skill activates, so spend
words here on judgment, not on restating what the model already knows.

## Reason, don't bark

LLMs follow reasoning more reliably than bare imperatives, and the reasoning
carries the model through cases the rule never anticipated. A naked `ALWAYS` /
`NEVER` tells the model *what* but not *why* — so when it meets a situation the
rule didn't foresee, it has nothing to reason from.

Rigid (less effective):
```markdown
- NEVER navigate to the editor during the build
```

Reasoned (more effective):
```markdown
- Stay on the hub during the build. The user watches thumbnails appear
  progressively — navigating to the editor would break that visual feedback loop.
```

Keep hard `NEVER`s only for genuinely irreversible or dangerous actions (force-push,
destructive deletes, committing secrets). Even then, one clause of *why* makes the
rule stick. Everywhere else, state the consequence and let the model reason.

## Degrees of freedom — match specificity to fragility

Think of the model as a robot following a path. A narrow bridge over cliffs needs
exact steps; an open field with no hazards needs only a direction. Over-specifying
an open-field task wastes tokens and makes the skill brittle to inputs you didn't
foresee; under-specifying a narrow-bridge task invites a fall.

| Freedom | When | How to write it |
|---|---|---|
| **High** (open field) | Many valid approaches; the right move depends on context | Give direction and goals, not steps. "Review for correctness and security; report findings by severity." |
| **Medium** (template + params) | A preferred pattern exists but variation is fine | Provide a template or example and name the parts the model may adapt. |
| **Low** (exact script) | Operations are fragile, order matters, consistency is critical | Give the exact command/sequence and say not to deviate. e.g. a migration's exact invocation, no extra flags. |

Decide the freedom level *per section* — a skill can be high-freedom in its
analysis phase and low-freedom in its apply phase.

## Imperative form

Write instructions as direct commands to the agent: "Extract the palette", "Read
the template", "Run the validator". Avoid "You should…", "The skill will…", and
documentation voice — the body is a directive to an executing agent, not prose for
a human reader.

## Consistent terminology

Pick one term for each concept and use it throughout. If you call it a "reference
file" once, don't later call it a "resource doc", "support file", or "ref". Drift
forces the model to guess whether two names mean the same thing, and it sometimes
guesses wrong.

## Named anti-patterns

Specific failure modes, named, beat a generic "make it good":

- **Vague skill names** — `helper`, `utils`, `tools`, `documents`. The name is part
  of the trigger surface; make it describe the job (`pdf-form-filler`, not `pdf-tools`).
- **Too many options** — offering five alternatives makes the model dither. Give one
  default and one escape hatch ("do X; if X doesn't apply, do Y").
- **Time-sensitive info inline** — "the new API" rots. Put superseded material in a
  `<details>` block labelled "Legacy / old patterns" so it's available but clearly dated.
- **Windows-style paths** — `scripts\helper.py`. Use forward slashes everywhere; they
  work on every target platform this repo supports.
- **Cross-skill dependencies** — a skill that only works if another skill ran first is
  fragile. Keep each skill self-contained; duplicate a few lines rather than depend.
- **Fiddly one-case rules** — instructions tuned to a single example you tested don't
  generalize. State the principle, then illustrate with the example.

## A note on craftsmanship language

Some guidance recommends repeating quality words ("meticulously crafted",
"painstaking attention") to push generative quality. That targets creative /
visual-output skills. This repo's skills are mostly knowledge + workflow skills, so
skip the craftsmanship-repetition register — a clear reasoned instruction does more
here than an exhortation.
