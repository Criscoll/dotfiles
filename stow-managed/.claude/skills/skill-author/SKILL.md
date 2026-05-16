---
name: skill-author
description: Create or update a Claude Code skill under stow-managed/.claude/skills/. Use when the user says "create a skill", "write a skill", "new skill called X", or "update skill X".
disable-model-invocation: false
---

You are running the skill-author skill. Your job is to create or update a skill in this dotfiles repo.

`$ARGUMENTS` contains the skill name and any description the user provided.

## Conventions to follow

**Location:** `stow-managed/.claude/skills/<skill-name>/SKILL.md`

Skills are stowed to `~/.claude/skills/` and picked up by Claude Code automatically. Supporting files (reference data, templates) can live alongside `SKILL.md` in the same directory — reference them at runtime via `$CLAUDE_SKILL_DIR`.

**Frontmatter (required):**
```markdown
---
name: <skill-name>
description: <one-liner that covers both purpose and trigger phrases>
disable-model-invocation: false
---
```

The `description` field is used by Claude to decide when to invoke the skill — make it specific and include example trigger phrases.

**`$ARGUMENTS`:** anything the user typed after the skill name. Parse it generously; skills should degrade gracefully when arguments are absent.

**`$CLAUDE_SKILL_DIR`:** absolute path to the skill's directory at runtime. Use it to reference sibling files:
```bash
cat "$CLAUDE_SKILL_DIR/reference.md"
```

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
