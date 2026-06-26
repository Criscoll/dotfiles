# Naming by Element Type

## Functions — verbs first

Functions need verbs. Use verbs that describe what the function does: `calculate`,
`deduct`, `mark`, `ship`, `approve`, `deny`.

**Return-type signals from verb choice:**
- `isEmpty()`, `hasRisks()`, `canShip()` — signals boolean return clearly. `empty()`
  is ambiguous (empties the collection? tests emptiness?). The verb is the contract.
- `getX()` — only for trivial field reads. If you need `[[nodiscard]]` because nobody
  checks the return value, the name failed to signal that a return value exists — fix
  the name, not the attribute.
- `fetchX()`, `loadX()`, `readX()` — signals I/O (network, file, database). Don't
  use these for a simple `return field_`.

**Verb-first vs noun-first ordering:** Neither is universally right. Verb-first
(`hasEntries`, `hasRisks`) groups by helper verb in alphabetical IDEs. Noun-first
(`entriesHas` is awkward, but `entriesCount`, `entriesSort`) groups by subject.
Make a deliberate choice and be consistent within a codebase.

**Constructors and destructors** are better than `initialize()` and `tearDown()`.
Everyone knows when constructors and destructors run; no one has to remember to call
them. If a class needs explicit setup/teardown, that signals a design issue, and you
should at minimum name the methods to make their necessity obvious.

## Classes — nouns, not verbal nouns

Classes are nouns. Avoid `-er` suffixes (`Formatter`, `Printer`, `Organizer`) — they
are verbal and vague. What does it format? Try naming by what it operates on:
`Printer` → `ReportPrinter` → often you realize the verb was redundant → `Report`.

Don't add design-pattern suffixes unless there are multiple competing types that
genuinely need distinguishing. `InventorySingleton` → `Inventory` when there is no
other inventory. `ScheduleFactory`/`ScheduleAdapter`/`ScheduleProxy` are fine when
you actually have all three.

Don't prefix class names with product initials or code names. Code names rarely
survive to release, but prefixes do. Namespaces exist for disambiguation.

**Don't repeat the class name in members:**
- `employee.employeeName` → `employee.fullName`
- `employee.printEmployeeRecord()` → `employee.print()` (unless "employee record" is
  the shared business term for the artifact being printed)

**Class purpose, not class contents.** A class named `NameAndAddressAndPhoneNumber`
names its fields, not its purpose. Its purpose is `ContactInfo`. As fields are added
or removed over time, the name won't need to change.

## Variables — nouns dripping in adjectives

Variables are nouns. Add adjectives until the variable has a specific identity:
- `name` → `fullName` (is it whole name or just last name? split or unsplit?)
- `salary` → `yearlySalary` (not hourly, not monthly)
- `employee` → `nextEmployee`, `currentOrder`, `remainingWork`
- Collections: `policies` for the plural; `activePolicies`, `draftPolicies` when
  you know why you have them

**Make purpose explicit, not just type.** Ask: "Why do I have a vector of policies?"
Put that answer in the name. A generic `policies` hiding its purpose is the variable
equivalent of a function called `process`.

**Don't encode types in names.** No `employeeString`, `countInt`, `isValidFlag`.
Exception: `date` as a suffix is conventional and commonly accepted (`orderPlacementDate`).

**Single-letter names** are acceptable in exactly two situations:
1. Genuinely tiny scope — a transient variable used and discarded within a few lines,
   where the name carries no load because the context is fully visible
2. Scientific formula implementation — when code implements a known formula, use the
   formula's notation. Translating `T` to `time` confuses anyone comparing code to
   the source. Use the formula's letters; the discipline is the documentation.

## Parameters — cues for callers, not just for the body

Parameters serve two purposes: they are local variables inside the function, and they
are API documentation for callers (IDE tooltips, hover docs). Name for the caller:
- `yearlySalary` not `salary` — the parameter tooltip tells the caller what kind of
  salary to supply
- Don't shadow member variables — if the member is `x`, the parameter shouldn't also
  be `x`. Decorate the member (`_x`, `m_x`) rather than the parameter so that the
  caller-facing name stays clean.

## Enums — consider hiding them

Every enum value that leaks into caller code forces callers to know the enum type.
Offering `approve()` and `deny()` methods that internally set `Status::Approved` hides
the implementation. Ask: can you reduce how many call sites need to reference the enum?

When the enum must be exposed: prefer scoped enums (`enum class`). Avoid encoding the
enum type name in values — `STATUS_APPROVED` → `Status::Approved`.

## Template Type Parameters

- **One type:** `T` is fine — it is universally understood as "any single type."
- **Two or more:** name them meaningfully: `TElement`/`TAllocator`, not `T`/`U`/`V`.
  Back to Nicole's rule: "newbies can shorten them once they understand it" is not
  a standard. Write the meaningful name from the start.
- `typename` vs `class` in the declaration: `typename` is technically more precise
  (accepts primitives too), but this is a bikeshed — pick one and be consistent.

## Abbreviations

Abbreviations are generally bad. The exceptions are terms so widely used they have
become their own words:
- `id` — acceptable
- `info` (as in `contactInfo`, `orderInfo`) — acceptable

Everything else: write it out. `ann_rev` for `annualRevenue` is easy to produce and
hard to decode. Three developers independently abbreviated the same concept as
`ann_rev`, `tot_inc`, and `rev_diff` — nobody could tell that two of them meant the
same thing.

Single-letter names followed by numbers (`d1`, `d2`, `d3`) are not better than
random letters. They suggest a tuple-style collection — and collections should be
named for what they contain, not indexed by position.
