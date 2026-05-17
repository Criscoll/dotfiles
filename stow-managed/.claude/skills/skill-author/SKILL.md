---
name: skill-author
description: Create or update a Claude Code skill under stow-managed/.claude/skills/. Use when the user says "create a skill", "write a skill", "new skill called X", or "update skill X".
disable-model-invocation: false
---

You are running the skill-author skill. Your job is to create or update a skill in this dotfiles repo.

`$ARGUMENTS` contains the skill name and any description the user provided.

## Conventions to follow

**Location:** `stow-managed/.claude/skills/<skill-name>/SKILL.md` for global skills shared across all projects.

For skills that reference a specific repo (paths, project conventions, domain knowledge tied to one codebase), place them in `<repo>/.claude/skills/<skill-name>/SKILL.md` instead — they load automatically in that project and don't pollute the global skill list. If it's unclear whether a skill is global or project-specific, ask the user.

Skills are stowed (or placed directly) into `~/.claude/skills/` and picked up by Claude Code automatically. Supporting files (reference data, templates) can live alongside `SKILL.md` in the same directory — reference them at runtime via `$CLAUDE_SKILL_DIR`.

**Frontmatter (required):**
```markdown
---
name: <skill-name>
description: <one-liner that covers both purpose and trigger phrases>
disable-model-invocation: false
---
```

The `description` field is used by Claude to decide when to invoke the skill — make it specific and include example trigger phrases.

## Writing a good description field

The description is the only thing Claude reads to decide whether to invoke the skill. A weak description means the skill silently never fires.

**Structure it in three parts:**

1. **What the skill does** — one clause, plain language: `"Apply Python best practices…"`
2. **When to auto-invoke** — explicit pre-condition with "Auto-invoke BEFORE…": `"Auto-invoke BEFORE writing or running any Python code, reading/editing any .py file…"`
3. **Trigger phrases** — a comma-separated list of exact words/phrases the user or context might contain: `"Trigger phrases: 'python', 'uv', '.py file', 'pip install'"`

**Rules:**
- Use "Auto-invoke BEFORE" (not "trigger on" or "use when") — imperative phrasing fires more reliably than passive descriptions
- List surface-level artifacts (file extensions, command names, keywords) not just intent — Claude matches on what it observes, not what it infers
- Keep it one sentence so it fits in the system-reminder index without truncation
- If the skill should only fire on explicit user request (not automatically), omit the auto-invoke clause and use only "Use when the user says…" phrasing

**Examples:**

Weak (passive, no pre-condition):
> Apply Python best practices. Trigger phrases: "python", "uv".

Strong (imperative, explicit pre-condition, observable triggers):
> Apply Python best practices — covers build toolchain and package management. Auto-invoke BEFORE writing or running any Python code, reading/editing any .py file, or executing any uv/pip/poetry command. Trigger phrases: "python", "pip install", "virtualenv", "pyproject.toml", ".py file", "uv", "poetry".

**`$ARGUMENTS`:** anything the user typed after the skill name. Parse it generously; skills should degrade gracefully when arguments are absent.

**`$CLAUDE_SKILL_DIR`:** absolute path to the skill's directory at runtime. Use it to reference sibling files:
```bash
cat "$CLAUDE_SKILL_DIR/references/pandas.md"
```

## Progressive Disclosure — Reference Files

For skills that cover multiple distinct sub-topics, keep `SKILL.md` lean and offload detail into a `references/` subdirectory. `SKILL.md` always loads; reference files are read on demand via the Bash tool only when the relevant context is active.

**Directory layout:**
```
my-skill/
├── SKILL.md              # always loaded — core rules + conditional load instructions
└── references/
    ├── topic-a.md
    └── topic-b.md
```

**In `SKILL.md`, add a load-on-demand section:**
```markdown
## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/topic-a.md** — load when: <condition>
- **references/topic-b.md** — load when: <condition>
```

**Rules:**
- Use a `references/` directory — never flatten with a `ref-` filename prefix
- Each reference file should cover exactly one sub-topic
- Load conditions should be concrete and observable (tool name, file type, error keyword), not vague intent

## Authoring approach

1. Understand the skill's job in one sentence before writing anything
2. Write the prompt as a directive to an agent, not as documentation
3. Use numbered steps for sequential flows; bullets for parallel work
4. Be explicit about what NOT to do (push, amend, use blanket staging, etc.) when the stakes are high
5. Keep it lean — add detail only where ambiguity would cause real harm
6. Prefer concrete examples over abstract rules in the prompt body

## What to produce

1. Create the directory if it doesn't exist
2. Write `SKILL.md` with correct frontmatter and a focused prompt
3. Show the user the final file content
4. Remind them to `git add` and commit when ready — do not commit automatically
