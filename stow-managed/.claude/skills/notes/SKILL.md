---
name: notes
description: >-
  Maintain and navigate the scribbles 01_Notes vault — folder taxonomy, note
  placement, file naming, frontmatter, aliases, Index.md, and sourced
  research. Use the vault as a knowledge base: when investigating a topic,
  search it first before duplicating work. Auto-invoke BEFORE creating a new
  note, choosing where a note belongs, writing or editing frontmatter,
  creating folder aliases, creating or updating an Index.md, writing up
  research findings into a note, reviewing 01_Notes structure, or looking for
  existing documentation on a topic within the vault. Trigger phrases:
  "create a note", "new note", "add a note", "where does this note go", "note
  aliases", "folder aliases", "semantic search notes", "note frontmatter",
  "01_Notes", "scribbles notes", "note template", "which folder", "notes
  management", "note naming", "Index.md", "folder index", "note index",
  "cite sources", "save research to a note", "search the vault", "do I have
  notes about", "is there a note on", "find existing knowledge".
disable-model-invocation: false
---

# Notes Conventions

The notes root is at `~/Repos/scribbles/01_Notes/`.

This skill serves two roles:
1. **Discipline** — rules for creating, placing, and formatting notes in the vault.
2. **Discovery** — a schema you can use to locate existing knowledge when investigating a question. The vault is structured for semantic lookup; consult it before generating new research from scratch.

---

## Vault Schema — Quick Reference

```
01_Notes/
├── 01_Tech/            → Software, hardware, AI, tools, CLI, programming
├── 02_Health/          → Physical health, fitness, sleep, medical
├── 03_Adulting/        → Finance, housing, legal, career, logistics
├── 04_Hobbies/         → Photography, hiking, blogging, creative pursuits
├── 05_Social/          → Relationships, events, social logistics
├── 06_Travel/          → Trip planning, packing, travel ideas
├── Cooking/            → Recipes, techniques
├── Learning/           → Economics, structured courses, study notes
├── Meditation/         → Practice notes, yoga nidra
├── Mimi/              → Partner-specific: gifts, date ideas, personal tracking
├── MISC/              → Genuinely uncategorizable
├── Glossary/           → Term definitions across domains
└── External Notes/     → Read-only imported TIL notes — do not add new entries here
```

Subdirectories at any depth are fine — create them freely to reflect topic
depth (e.g. `01_Tech/AI/Agents/`).

---

## How to Search the Vault (Discovery)

When an agent needs existing knowledge on a topic, use this approach in order:

1. **Use the taxonomy above** to narrow which top-level folder(s) the topic
   belongs under, then `rg <pattern> <folder>/` to find matching notes.
2. **Follow the `Index.md` chain** — start at a top-level `Index.md` (e.g.
   `01_Tech/Index.md`) and follow links to child directory `Index.md` files
   until you land on the specific note. Every directory with content should
   have one.
3. **Check `00_Aliases/` directories** — empty files whose names are search
   synonyms for the folder they live in. `fd alias_name` or `fd` through a
   directory finds them.
4. **Only after searching the vault** — if the topic genuinely isn't covered,
   create a new note using the conventions below.

Goal: avoid re-researching something already written down. The vault is a
knowledge-base cache; use it.

---

## Note Placement Decision Tree

Work through these in order; stop at the first match:

1. Does it belong to one of the six numbered categories? → place there.
2. Is it one of the special folder domains (Cooking, Mimi, etc.)? → place there.
3. Is it a term definition? → `Glossary/`.
4. No match? → `MISC/` temporarily; note that a new subdirectory may be warranted.

When in doubt between two categories, prefer the more specific subdirectory
over the generic parent — specificity is easier to search than breadth.

---

## File Naming

Use natural-language names, title-cased. No underscores in note filenames
(directories may use underscores for path compatibility).

```
How to Cook a Steak.md      ✓
Docker Cheat Sheet.md       ✓
how_to_cook_a_steak.md      ✗
```

---

## Frontmatter Template

Every note opens with YAML frontmatter:

```yaml
---
aliases:
  - synonym one
  - synonym two
description: One-sentence summary of what this note contains.
tags:
  - "#Note"
topics:
  - docker
---
```

**`aliases`** — 2–5 alternative names or phrases someone might search for to
reach this note. These power Obsidian's fuzzy search. Be varied: include
abbreviations, alternate spellings, question forms. Example for a note on
Docker GPU access: `["gpu in docker", "nvidia container", "container gpu
passthrough"]`.

**`description`** — one sentence; answers "what does this note tell me?"

**`tags`** — use `#Note` for reference notes, `#Journal` for time-stamped
entries, `#Cheat-Sheet` for command references.

**`topics`** — lowercase keywords matching the folder/subdomain (helps
semantic grouping).

---

## Folder Alias Convention — `00_Aliases/`

Each folder that covers a distinct topic **should** have a `00_Aliases/`
subdirectory (use `00_Aliases/` — no dots or spaces). Inside it, create empty
`.md` files whose *filenames* are semantic aliases for the folder.

Purpose: Obsidian and fd-based search match on filenames. An empty file named
`containerization.md` inside `01_Tech/docker/00_Aliases/` makes
"containerization" a searchable entry point into that folder — without
polluting any real note.

**Rules:**

- Filenames are lowercase, hyphen-separated phrases.
- Aim for 3–8 aliases per folder.
- Include the folder's own name, common synonyms, and question fragments
  ("how to containers", "running services in isolation").
- Do not duplicate the exact folder name — add *alternatives*.
- Files are always empty (0 bytes). All content goes in real notes, not alias files.

**Example** — `01_Tech/docker/00_Aliases/`:
```
containerization.md
containers.md
docker-compose.md
running services in isolation.md
container runtime.md
```

**Example** — `02_Health/Weightlifting/00_Aliases/`:
```
lifting.md
strength training.md
gym.md
barbell.md
resistance training.md
```

---

## Folder Index Convention — `Index.md`

Every directory in `01_Notes/` that contains subdirectories and/or notes of
its own **should** have an `Index.md`. Where `00_Aliases/` helps filename
search find a folder, `Index.md` helps a search — human or agent — navigate
*down* through the vault: start at a top-level `Index.md`, follow a link to
a child's `Index.md`, repeat until you land on the right note.

**Structure:** a one-line description of the folder's theme, then a list of
its *immediate* children (subdirectories and notes), each with a one-line
description and a link:

```markdown
# 01_Tech Index

Software, hardware, AI, tools, CLI, programming notes.

- [AI/](AI/Index.md) — LLMs, agents, prompting, auxiliary AI services
- [Programming/](Programming/Index.md) — languages, patterns, tooling
- [Docker Cheat Sheet.md](Docker Cheat Sheet.md) — command reference for Docker
```

**Rules:**

- List only **immediate** children — never the full recursive tree. Each
  child directory owns its own `Index.md`, which is what keeps the chain
  navigable instead of collapsing into one unmaintainable flat file.
- Don't list `00_Aliases/` as a child — it holds no real notes, just search
  aliases, so listing it would clutter the index without adding signal.
- Update a folder's `Index.md` whenever a note or subdirectory is added,
  moved, or removed from it. This is a lightweight, incremental habit done
  alongside the change that touched the folder — not a separate batch job.
- Going forward only: this convention isn't backfilled onto existing
  folders. Create or update a folder's `Index.md` only when you're already
  touching that folder (adding a note, creating a subdirectory, etc.) —
  don't proactively add `Index.md` to unrelated folders you happen to pass
  through.

---

## Sourcing Research Findings

If a note's content came from research — web search, a crawled page, a fetched
doc, a paper — record where it came from, and mark *which claim* it backs
inline, not just a source list at the bottom. A bare list can't tell a reader
which sentence relies on which source; inline markers can.

- Use numbered inline citation markers — `[1]`, `[2]` — placed right after the
  claim they support, in first-use order through the note.
- **Separate adjacent markers with a space: `[1] [3] [4]`, never `[1][3][4]`.**
  Without a space, Markdown parses `[1][3]` as a reference-style link (link
  text `1`, reference label `3`) — Obsidian and Neovim's treesitter-based
  markdown rendering both conceal the reference-label half, so `[1][3][4]`
  visually renders as `14` with the middle marker silently swallowed.
- Add a `## Sources` section at the end of the note with a matching numbered
  list: `1. [Title](URL) — accessed YYYY-MM-DD`. The number in the list must
  match the inline marker, not just be sequential by coincidence.
- Reuse a marker if the same source backs a later claim too — don't mint a new
  number for a source already listed.
- For a source with no meaningful title (a bare API response, a forum post),
  describe it instead of leaving a naked link: `1. [Reddit thread on X](URL)`.
- If only part of a note came from research (the rest is personal experience
  or prior knowledge), only cite the researched claims — don't add markers to
  sentences that didn't come from a source.
- This applies regardless of which tool did the lookup (web-search skill,
  WebFetch, web-crawl skill, pdf-parse skill) — the citation matters, not the
  mechanism.

Example:
```markdown
Bridge mode is the default Docker network driver on Linux [1]. Host mode
skips network isolation entirely, which is faster but only safe for
single-container setups [2]. Both trade off differently under load [1] [2].

## Sources

1. [Docker networking docs](https://docs.docker.com/network/) — accessed 2026-07-28
2. [Stack Overflow: bridge vs host mode](https://stackoverflow.com/...) — accessed 2026-07-28
```

---

## Note Type Templates

**Cheat sheet / command reference**

```markdown
---
aliases: [...]
description: Quick reference for X commands.
tags: ["#Cheat-Sheet"]
topics: [...]
---

# X Cheat Sheet

## Section

Brief explanation.

```bash
command --flag
```
```

**Concept / reference note**

```markdown
---
aliases: [...]
description: Explanation of X and how to apply it.
tags: ["#Note"]
topics: [...]
---

# X

What it is, why it matters. Links and quotes from sources.
```

**Journal / tracking entry**

```markdown
---
aliases: [...]
description: Log of X over time.
tags: ["#Journal"]
topics: [...]
---

# X Journal

## YYYY-MM-DD

Entry.
```

---

## Creating a New Note — Checklist

1. Determine the folder using the decision tree above.
2. Create the file with a natural-language, title-cased name.
3. Add YAML frontmatter with meaningful aliases (2–5 alternatives, not the
   note's own title).
4. Check whether the parent folder has a `00_Aliases/` directory; if not,
   create one with 3–8 empty alias files.
5. Check whether the parent folder's `Index.md` needs a new entry for this
   note; create the `Index.md` if the folder doesn't have one yet.
6. Pick the appropriate template above and fill in the content.
7. If any content came from research (web search, a crawled page, a fetched
   doc), add a `## Sources` section listing each source used.