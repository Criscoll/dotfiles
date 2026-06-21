---
name: skill-author
description: >-
  Create or update a Claude Code skill under stow-managed/.claude/skills/. Use when the user says "create a skill", "write a skill", "new skill called X", or "update skill X".
disable-model-invocation: false
---

You are running the skill-author skill. Your job is to create or update a skill in this dotfiles repo.

`$ARGUMENTS` contains the skill name and any description the user provided. Parse it generously; degrade gracefully when arguments are absent.

## Conventions to follow

**Location:** `stow-managed/.claude/skills/<skill-name>/SKILL.md` for global skills shared across all projects.

For skills that reference a specific repo (paths, project conventions, domain knowledge tied to one codebase), place them in `<repo>/.claude/skills/<skill-name>/SKILL.md` instead — they load automatically in that project and don't pollute the global skill list. If it's unclear whether a skill is global or project-specific, ask the user.

Skills are stowed (or placed directly) into `~/.claude/skills/` and picked up by Claude Code automatically. Supporting files (reference data, templates) live alongside `SKILL.md` in the same directory — reference them at runtime via `$CLAUDE_SKILL_DIR`:
```bash
cat "$CLAUDE_SKILL_DIR/references/pandas.md"
```

**Frontmatter (required):**
```markdown
---
name: <skill-name>
description: >-
  <one-liner that covers both purpose and trigger phrases>
disable-model-invocation: false
---
```

Always use the `>-` block scalar for `description`. Skill descriptions almost always contain `Trigger phrases: "..."` which introduces a colon inside an unquoted YAML value — strict YAML parsers (including pi's) reject this with "Nested mappings are not allowed in compact mappings". `>-` folds the value into a plain string and sidesteps the issue. Don't write `description: <inline text>` if the text contains a colon.

## Description essentials

The description is the *only* thing Claude reads to decide whether to invoke the skill — a weak one means the skill silently never fires. Structure it in three parts:

1. **What the skill does** — one clause, plain language: `"Apply Python best practices…"`
2. **When to auto-invoke** — explicit pre-condition with "Auto-invoke BEFORE…": `"Auto-invoke BEFORE writing or running any Python code, reading/editing any .py file…"`
3. **Trigger phrases** — a comma-separated list of exact words/phrases the user or context might contain: `"Trigger phrases: 'python', 'uv', '.py file', 'pip install'"`

Weak (passive, no pre-condition):
> Apply Python best practices. Trigger phrases: "python", "uv".

Strong (imperative, explicit pre-condition, observable triggers):
> Apply Python best practices — covers build toolchain and package management. Auto-invoke BEFORE writing or running any Python code, reading/editing any .py file, or executing any uv/pip/poetry command. Trigger phrases: "python", "pip install", "virtualenv", "pyproject.toml", ".py file", "uv", "poetry".

For the deeper rules, the auto-invoke-vs-explicit distinction, and the 20-query trigger-accuracy test (the single highest-leverage improvement), load `references/description-and-triggers.md`.

## Authoring approach

1. Understand the skill's job in one sentence before writing anything.
2. Write the prompt as a directive to an executing agent, not as documentation.
3. Use numbered steps for sequential flows; bullets for parallel work.
4. Explain *why* a rule exists rather than barking ALWAYS/NEVER — reasoning generalizes to cases the rule didn't anticipate, and the model follows it more reliably.
5. Match instruction specificity to task fragility — a fragile narrow-bridge step needs an exact command; an open-field decision needs only direction. See `references/instruction-design.md`.
6. Keep it lean — add detail only where ambiguity would cause real harm. Prefer concrete examples over abstract rules.
7. Be explicit about high-stakes don'ts (force-push, blanket staging, destructive deletes), with a clause of why.

## Progressive disclosure — reference files

For skills covering multiple distinct sub-topics, keep `SKILL.md` lean and offload detail into a `references/` subdirectory. `SKILL.md` always loads; reference files are read on demand only when the relevant context is active. (This skill is itself an example — the body stays short, depth lives in `references/`.)

```
my-skill/
├── SKILL.md              # always loaded — core rules + conditional load instructions
└── references/
    ├── topic-a.md
    └── topic-b.md
```

In `SKILL.md`, add a load-on-demand section:
```markdown
## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/topic-a.md** — load when: <condition>
- **references/topic-b.md** — load when: <condition>
```

Rules:
- Use a `references/` directory — never flatten with a `ref-` filename prefix.
- Keep references one level deep — `SKILL.md → references/x.md`, never `x.md → y.md` (the agent reads with previews and misses nested content).
- Each reference file covers exactly one sub-topic.
- Load conditions are concrete and observable (tool name, file type, error keyword), not vague intent.

## What to produce

1. Create the directory if it doesn't exist.
2. Write `SKILL.md` with correct frontmatter and a focused prompt.
3. Show the user the final file content.
4. Run the **review checklist** below.
5. Remind them to `git add` and commit when ready — do not commit automatically.
6. **Check symlink status**: run `ls -la ~/.claude/skills/<skill-name>` — if the symlink is missing, run `stow -v --simulate -t ~ stow-managed` to preview, then `stow -v -t ~ stow-managed` to apply. Report what was linked (or confirm it was already in place). Only for global skills under `stow-managed/.claude/skills/` — project-scoped skills are picked up automatically and need no stow step.

## Review checklist (run before declaring done)

- [ ] Description has all three parts: what + when + trigger phrases (and uses `>-`).
- [ ] Instructions are reasoned, not rigid — `why` given instead of bare ALWAYS/NEVER.
- [ ] Degrees of freedom fit the task — exact steps where fragile, direction where open.
- [ ] Consistent terminology throughout; skill name is descriptive, not `helper`/`utils`/`tools`.
- [ ] If multi-topic: detail extracted to `references/`, one level deep, one sub-topic per file.
- [ ] If it ships scripts or spawns subagents: `references/quality-scripts-subagents.md` rules applied (declared deps, no voodoo constants, inlined subagent context).
- [ ] If it drives a noisy CLI or API: wrapper scripts in `~/bin/agent_scripts/` exist for the common read paths so agents don't re-derive parsing each session (token-efficiency wrapper pattern — see `references/quality-scripts-subagents.md`).
- [ ] Symlink verified via `ls -la` (global skills only).

## Load Reference Files When Relevant

Read these using the Bash tool (`cat "$CLAUDE_SKILL_DIR/references/<file>"`). Do not guess their contents — read them.

- **references/description-and-triggers.md** — load when: writing or revising a skill's `description` or trigger phrases, choosing auto-invoke vs explicit-only, or testing trigger accuracy.
- **references/instruction-design.md** — load when: writing the SKILL.md body, deciding how rigid an instruction should be, setting degrees of freedom, or naming the skill.
- **references/quality-scripts-subagents.md** — load when: the skill ships scripts, spawns subagents, or needs workflow checklists, validator feedback loops, or output-format templates.
- **references/language-skills.md** — load when: the skill being authored covers a programming language, framework, library, or technology stack (e.g. Python, TypeScript, Svelte, React, Go).
