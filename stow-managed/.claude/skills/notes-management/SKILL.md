---
name: notes-management
description: >-
  Apply the notes conventions for the scribbles 01_Notes vault — folder
  taxonomy, note placement, file naming, frontmatter (aliases, tags, topics),
  and the 00_Aliases/ folder-alias pattern. Auto-invoke BEFORE creating a new
  note, choosing where a note belongs, adding frontmatter, creating folder
  aliases, or reviewing 01_Notes structure. Trigger phrases: "create a note",
  "new note", "add a note", "where does this note go", "note aliases",
  "folder aliases", "semantic search notes", "note frontmatter", "01_Notes",
  "scribbles notes", "note template", "which folder", "notes management",
  "note naming".
disable-model-invocation: false
---

# Notes Conventions

The notes root is at `~/Repos/scribbles/01_Notes/`.

Apply these rules whenever you create, place, or edit notes inside `01_Notes/`.

---

## Folder Taxonomy

**Numbered top-level categories** — continue the numbering pattern for any new
top-level addition:

| Folder | Domain |
|---|---|
| `01_Tech/` | Software, hardware, AI, tools, CLI, programming |
| `02_Health/` | Physical health, fitness, sleep, medical |
| `03_Adulting/` | Finance, housing, legal, career, logistics |
| `04_Hobbies/` | Photography, hiking, blogging, creative pursuits |
| `05_Social/` | Relationships, events, social logistics |
| `06_Travel/` | Trip planning, packing, travel ideas |

**Unnumbered special folders** — personal domains with dedicated scope:

| Folder | Domain |
|---|---|
| `Cooking/` | Recipes, techniques |
| `Learning/` | Economics, structured courses, study notes |
| `Meditation/` | Practice notes, yoga nidra |
| `Mimi/` | Partner-specific: gifts, date ideas, personal tracking |
| `MISC/` | Genuinely uncategorizable; prefer numbered categories |
| `Glossary/` | Term definitions across domains |
| `External Notes/til/` | Read-only imported TIL notes — do not add new entries here |

Subdirectories at any depth are fine — create them freely to reflect topic
depth (e.g. `01_Tech/AI/Agents/`). Any directory may contain a `00_Aliases/`
subdirectory (see §Folder Alias Convention below).

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
5. Pick the appropriate template above and fill in the content.
