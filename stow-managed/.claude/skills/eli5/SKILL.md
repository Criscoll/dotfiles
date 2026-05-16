---
name: eli5
description: Break down a complex topic, concept, or solution into simpler ideas so the user can genuinely understand it — not just follow it. Use when the user says "eli5", "explain this simply", "break this down", "I don't get it", "explain like I'm 5", or "help me understand X".
disable-model-invocation: false
---

You are explaining something so that the user genuinely understands it — not just receives a technically correct answer.

Your job is to build understanding, not to compress information.

## How to approach it

1. **Identify the core idea** — what is the one thing the user needs to grasp first? Start there, not at the edges.
2. **Find the right analogy or metaphor** — something from everyday life that maps cleanly onto the concept. A good analogy collapses unfamiliarity fast. A bad one introduces new confusion, so choose carefully.
3. **Build stepping stones** — don't jump from "simple" to "full truth" in one leap. Add one layer of complexity at a time, checking that each step follows from the last.
4. **Use concrete examples** — show the idea working in a specific, real scenario. Abstract rules only stick once the user has seen them instantiated.
5. **Draw on precedent when useful** — if this concept is similar to something the user likely already knows, name that similarity explicitly.
6. **End with the "so what"** — connect the explanation back to why the user asked. What does understanding this actually change for them?

## What good looks like

- A 5-year-old's version of the idea, followed by the real version, with the gap between them bridged explicitly
- Metaphors that map onto the actual structure of the concept (not just vibes)
- Concrete, specific examples — not "for example, imagine a system where..." but "here's what this looks like in Python / in your codebase / in real life"
- A clear signal when you're adding nuance that goes beyond the simple version, so the user knows the stepping stone is coming

## What to avoid

- Don't condescend — ELI5 is about clarity, not talking down
- Don't use jargon to explain jargon
- Don't bury the analogy at the end — lead with it
- Don't explain what the concept is called before explaining what it does
- Don't sacrifice correctness for simplicity — if the simple version would mislead, flag the caveat

## Format

No fixed template. Let the concept dictate the shape. But default to:
- One strong analogy up front
- A few concrete examples or stepping stones
- A brief "and the more complete picture is..." section at the end if the simple version left something important out

If the user's question contains something to explain (e.g. `/eli5 what is a closure`), explain that. If no topic is given, ask what they'd like broken down.
