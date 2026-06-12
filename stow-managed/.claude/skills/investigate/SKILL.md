---
name: investigate
description: >-
  Prime the investigative mindset and structured sequence for any debugging, root-cause analysis, reverse-engineering, or conceptual spelunking task. Auto-invoke BEFORE attempting any fix or diagnosis. Trigger phrases: "debug this", "why is this happening", "figure out why", "trace this error", "something's wrong with", "investigate", "reverse engineer", "root cause", "I'm seeing a weird issue", "what's going on with", "it's broken", "this doesn't work".
disable-model-invocation: false
---

You are entering investigation mode. Do NOT propose a fix until you have completed the sequence below.

## Core Philosophy

1. **The error tells you WHERE. You have to find WHY.**
   Don't fix the symptom location. Understand the mechanism that produced it.

2. **A theory is not a fact.**
   Form a hypothesis, then try to DISPROVE it — not confirm it. The first theory is usually incomplete. The goal is to find the theory that survives contact with all the evidence.

3. **One change, one test.**
   Never make two changes and declare victory. You learn nothing about which change mattered.

4. **When a fix doesn't work, the theory was wrong.**
   Don't adjust the fix. Restart the theory. Go back to the evidence.

5. **Ground truth hierarchy.**
   Installed source > docs > prior knowledge > assumptions. Read what's actually there. Never assume an API is what it was the last time you saw it.

6. **Invisible frames mean a boundary.**
   If the stack trace is truncated (coroutine, C call, async boundary), the visible frames are not the crash site — they're the wrapper. Find a way to see inside the boundary.

7. **Collect before concluding.**
   Gather: error text, version info, what changed, what the actual installed code does. Resist the urge to propose a fix before you have the full picture.

---

## Sequence

### Phase 1: Orient
- Quote the exact error message verbatim.
- What is the version of everything relevant? (runtime, plugin, dependency)
- What changed recently? (upgrade, update, edit)
- What is the smallest reproduction?

### Phase 2: Locate
- Where in the source does the error originate? Not just the stack frame — the actual call site.
- Is the stack trace complete? If not, WHY is it truncated? (async boundary, coroutine, C call)
  If truncated: extract the actual source and read the lines directly.
- Work backwards from the crash site through the call chain.

### Phase 3: Hypothesise
- State ONE specific theory: "X is nil because Y changed the format in version Z."
- State what evidence would confirm it AND what evidence would refute it.
- State what you expect the fix to produce.

### Phase 4: Verify
- Check the theory against the actual installed source. Read it.
- Use ground-truth references (built-in implementations, official examples, tests) as reference for what the correct API/behaviour looks like.
- If the theory doesn't fit the evidence, discard it and return to Phase 2.

### Phase 5: Fix
- Make the minimal change that addresses the root cause.
- Test it in isolation.
- If it doesn't work: the theory was wrong. Return to Phase 2 with new information.

---

## Anti-Patterns — Do Not Do These

- Proposing a fix before reading the source.
- Installing or updating things speculatively ("maybe the plugin is outdated").
- Reading docs instead of code when they conflict.
- Assuming a fix worked because there's no obvious error — test it properly.
- Continuing to tweak a non-working fix instead of re-deriving the theory.
- Making multiple changes at once.
- Concluding from a partial stack trace without investigating the invisible boundary.

---

## Useful Techniques

**When you can't see inside a boundary:**
Extract the actual source to a temp file and read it at the exact line numbers.

**When you don't know what changed:**
Diff the version before and after. Read the changelog/commit log for the component.

**When the API format is unclear:**
Read the canonical implementation (stdlib, runtime, framework internals) as ground truth. The built-in implementation IS the spec.

**When the error is in code you can't modify:**
Find the outermost layer you DO control and apply the adaptation there.

**When you have multiple suspects:**
Enumerate them explicitly. Eliminate the easiest-to-check ones first.
