---
name: naming
description: >-
  Apply Kate Gregory's naming principles to evaluate or improve names in code —
  covering truthfulness, consistency, element-specific rules, and common
  anti-patterns. Auto-invoke BEFORE suggesting or evaluating any name in code,
  when the user asks what to call something, or when reviewing names during
  refactoring. Trigger phrases: "what should I call", "good name", "better name",
  "naming", "naming convention", "naming advice", "variable name", "function name",
  "method name", "class name", "rename this", "what to name", "bad name for",
  "how should I name", "picking a name".
disable-model-invocation: false
---

# Naming

Source: Kate Gregory, "Naming is Hard: Let's Do Better" (NDC TechTown 2024).

Names are the primary explanation of an algorithm — they communicate to teammates,
customers, and future maintainers, not just to compilers. The principles below are
not stylistic preferences; they are about whether names stay true, stay consistent,
and tell the right story.

## The Single Most Important Thing

**Care.** Things get named `process`, `stuff`, `data`, `update`, and `miscellaneous`
because the developer didn't have time to care. Think about *why* a class, function,
or variable exists — its reason for being — and the name becomes almost obvious.

Insisting on a real name also forces the right size. A 5,000-line function called
`process` stays 5,000 lines precisely because no one ever had to name what it does.
Demand a name; you demand a clear purpose.

## Truthfulness: Names Must Stay True

Misleading names are worse than vague ones — they actively misdirect readers.

**Name by what, not when.** `preLoad()` and `postLoad()` convey only timing, which
the reader can already infer from control flow. If the pre-step checks permissions,
call it `checkPermissions()`. If the post-step sends emails, call it
`sendConfirmationEmails()`.

**Rename when a function body outgrows its name.** `setStatus()` was fine when it
only assigned a field. Once it triggered approvals, sent emails, and logged audits,
it became a lie. `approve()` and `deny()` signal "things happen here"; `setStatus()`
signals "nothing to see here — just a field assignment."

**Keep implementation details out of names.** `saveConfigFile()` should be
`savePreferences()`. `storageCoordinates` should be `location`. When the storage
mechanism changes, the name won't need to change with it.

## Consistency: One Word Everywhere

Use the same term in reports, UI labels, emails, spoken conversations, and code. When
the column header says "Expiry Date" but the code says `inactiveDate`, every
cross-functional conversation becomes harder than it needs to be.

- Correct people who use the wrong term in meetings — that's not pedantry, it's
  keeping the shared vocabulary coherent.
- Natural English pairs must match on both sides: `begin`/`end`, `first`/`last`,
  `create`/`destroy`, `open`/`close`, `get`/`put`, `source`/`destination`, `min`/`max`.
  Inconsistency *between* pairs is also a problem: `minTemp`/`maxTemp` is fine;
  `minTemp`/`tempMax` is not.
- Let the business give you names when possible. Invented programmer terms that
  diverge from how the business talks create a translation layer that compounds over time.

## The True Name Will Come — But It Must Come

Don't be paralyzed when you can't name something immediately:

1. Give a placeholder name and keep moving — you haven't read the code yet and will
   guess wrong.
2. Understand what the code does.
3. Rename the moment you know what it is. Don't write a `// TODO: rename` — put it
   in your task tracker. In-code reminders decay; only a real task gets done.

Using your refactoring tool for renames is non-negotiable. A manual find-and-replace
that changes `damage` to `daWizard` everywhere is how you learn why tools exist.

## Avoid Metaphor — Be Literal

Metaphors require shared background and are almost always ambiguous. `filter` could
mean "keep the matches" or "remove the matches" — there is no way to tell from the
name alone. Be literal instead:

- `allow`/`deny` instead of whitelist/blacklist
- `includeIf`/`excludeIf` instead of filter
- `active`/`inactive` instead of color codes or hat-color metaphors
- `operating`/`offline` instead of any metaphorical state

Don't assume the reader grew up with the same movies, idioms, or color conventions.

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`).
Do not guess their contents — read them.

- **references/by-element.md** — load when: giving advice on a specific element
  type (functions, classes, variables, parameters, enums, template type parameters,
  abbreviations).
