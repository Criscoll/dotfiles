# Writing Good CLAUDE.md Files

A reference for crafting high-leverage, low-noise `CLAUDE.md` files.
Source: [humanlayer.dev/blog/writing-a-good-claude-md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

---

## Why This File Matters

`CLAUDE.md` is injected into every conversation. It is the only persistent memory mechanism for a stateless model whose weights don't change between sessions. Every session starts from zero — the file is the bridge.

Its impact compounds: a bad line in code is one bad line; a bad instruction in `CLAUDE.md` multiplies across every conversation, plan, and implementation.

---

## The Three-Part Framework

Structure content around three questions:

- **WHAT** — Technical stack, project structure, where things live (especially important in monorepos)
- **WHY** — Purpose of the project and its major components
- **HOW** — Development workflow: which tools to use, how to run tests, how to verify changes

---

## Core Principles

### Less is more

Frontier LLMs reliably follow ~150–200 instructions total. Claude Code's own system prompt consumes ~50 of those slots. Every instruction you add competes with the rest for attention.

Claude Code also injects a caveat that the context "may or may not be relevant" — the more non-universal content you include, the higher the chance Claude skips instructions entirely.

**Target:** under 300 lines. Aim for under 100.

### Only include universally applicable content

If an instruction isn't relevant to most sessions, it doesn't belong in the root `CLAUDE.md`. Task-specific guidance (e.g., database schema, a specific service's API) should live in separate referenced docs.

### Use progressive disclosure

Create adjacent reference docs and list them with descriptions so Claude can pull them in on demand:

```
agent_docs/
  ├─ building_the_project.md
  ├─ running_tests.md
  ├─ code_conventions.md
  ├─ service_architecture.md
  └─ database_schema.md
```

The root file points to these; Claude decides relevance or asks before reading.

### Point, don't embed

Use `file:line` references to authoritative source code rather than copying snippets into the file. Embedded snippets drift; pointers stay honest.

### Don't use LLMs for linting

LLMs are slow and expensive for deterministic tasks. Use actual linters and formatters instead. Configure stop hooks in Claude Code to run formatters automatically. Link to a style guide rather than describing it inline.

### Never auto-generate

Skip `/init` and similar auto-generation commands. The file affects every phase of every workflow — it deserves deliberate, hand-crafted content.

---

## Checklist

- [ ] Covers WHY, WHAT, and HOW
- [ ] Total instructions stay under 150 (including Claude Code's ~50 built-in)
- [ ] File is under 300 lines (ideally under 100)
- [ ] Every instruction applies to most sessions
- [ ] Specialized docs are referenced, not inlined
- [ ] No linting or formatting instructions — use tools for that
- [ ] Written by hand, not auto-generated
