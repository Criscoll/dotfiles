# Skill Authoring Best Practices for Coding Agents

Date: 2026-06-17  
Sources: Anthropic official docs, Firecrawl blog, Termdock design principles, lipex360x/Anthropic skill repo analysis, pi.dev docs, community Reddit threads.

---

## The Big Picture: Progressive Disclosure (Three Tiers)

Every skill uses this architecture. Understanding it is foundational.

| Tier            | Content                  | Size       | When loaded                             |
|-----------------|--------------------------|------------|-----------------------------------------|
| **Metadata**    | `name` + `description`   | ~100 tokens | Always in context (every session)       |
| **Instructions** | SKILL.md body            | <500 lines | When the skill is activated              |
| **Resources**   | references/, scripts/, templates/ | Unlimited | On demand, when agent reads them        |

**Implication:** The description is the trigger. Everything else is secondary. If the description doesn't make the agent activate the skill, nothing else matters.

---

## 1. The Description Is Everything

This is the single highest-leverage improvement you can make. Agents **undertrigger** — they won't use a skill unless the match is obvious. Counter this with the **"pushy" technique**: list specific trigger phrases and contexts explicitly.

### Good vs Bad

**Weak (why it fails):**
```yaml
description: Helps with code review.
```

**Strong:**
```yaml
description: >
  Performs comprehensive code review after writing or modifying code.
  Use when completing logical chunks of development work. Analyzes
  security vulnerabilities, correctness issues, performance problems,
  and maintainability concerns. Outputs structured findings with
  severity ratings. Activate for PR reviews, staged change reviews,
  and file-level audits.
```

### Key Rules

- **Write in third person.** The description is injected into the system prompt. First or second person causes discovery problems.
- **Include both WHAT and WHEN.** What does it do? In what situations should the agent activate it?
- **Use the "even if they don't explicitly say X" pattern** to catch valid-but-indirect use cases.
- **Err on the side of triggering too often.** Loading an irrelevant skill costs a few hundred tokens. Not loading a relevant one means the agent improvises and gets it wrong.

### Testing Trigger Accuracy

Create 20 eval queries — 10 that should trigger, 10 that should not. Run each 3 times for reliable rates. Below 80% accuracy, rewrite the description and test again. This is tedious but the single highest-leverage improvement possible.

---

## 2. SKILL.md Body: Lean and Reasoned

### Keep It Under 500 Lines

If approaching this limit, move detail to `references/` files. The agent loads them only when needed.

### Explain the Why, Not Rigid Commands

LLMs respond better to reasoning than rote instructions. The reasoning also helps when the model encounters situations the rule didn't anticipate.

**Rigid (less effective):**
```markdown
- NEVER navigate to the editor during the build
```

**Reasoned (more effective):**
```markdown
- Stay on the hub during the build. The user watches thumbnails appear
  progressively — navigating to the editor would break the visual feedback loop.
```

### Use Imperative Form

Write instructions as direct commands: "Extract the color palette", "Read the template". Not "You should extract..." or "The skill will...".

### Set Appropriate Degrees of Freedom

Match specificity to the task's fragility:

| Freedom level | When to use | Example |
|---|---|---|
| **High** (open field) | Multiple approaches valid, decisions depend on context | Code review: give general direction |
| **Medium** (template w/ params) | Preferred pattern exists, some variation acceptable | Report generation: template + customize |
| **Low** (exact script, no deviation) | Operations are fragile, consistency critical | Database migration: exact command, no flags |

Think of Claude as a robot on a path:
- **Narrow bridge with cliffs** → exact instructions (low freedom)
- **Open field with no hazards** → general direction (high freedom)

### Structure with Clear Steps

Number the steps. Use headers for major phases. Gives the model a clear execution path and makes it easy to reference specific steps.

---

## 3. Progressive Disclosure: Referencing Files

### Keep References One Level Deep

Bad (agent uses `head -100` previews and misses content):
```
SKILL.md → advanced.md → details.md
```

Good:
```
SKILL.md → reference/finance.md
          → reference/sales.md
          → reference/product.md
```

### When to Extract to References/

- Detailed guidelines that not every execution needs to read in full
- Long templates or schemas that are stable
- Domain-specific content that only applies to certain inputs
- When SKILL.md approaches 500 lines

### How to Reference

Use natural language instructions, not special syntax:
```markdown
Read `references/artboard-guidelines.md` for the standard artboard structure.
```

This is an instruction for the agent to use the Read tool — not an `@` import (those only work in CLAUDE.md, not SKILL.md).

### Large References (>300 lines)

Include a table of contents at the top so the agent can navigate efficiently even with partial reads.

---

## 4. Quality Techniques That Actually Work

### Craftsmanship Repetition

Repeat quality expectations at multiple points in the instructions, not just once. This is intentional prompt engineering — it combats the tendency to produce "good enough" output. Use language like "meticulously crafted", "painstaking attention", "master-level execution" throughout.

### Anti-Patterns List

Name specific failure modes. Generic "make it good" doesn't work. Specific does:
```markdown
**Avoid these specific AI design traps:**
- Generic gradients (especially purple-to-blue on white)
- Uniform spacing everywhere — vary rhythm intentionally
- Placeholder images as plain gray boxes
```

### Refinement Over Addition

Build in an explicit "polish, don't add" step. AI tends to solve "it doesn't feel complete" by adding more elements. The better answer is usually refining what exists.

### Named Anti-Patterns to Avoid

- **Vague skill names:** `helper`, `utils`, `tools`, `documents`
- **Windows-style paths:** `scripts\helper.py` (use forward slashes)
- **Too many options:** Give a default + escape hatch, not five alternatives
- **Time-sensitive information:** Use `<details>` with "Legacy/Old patterns" sections
- **Inconsistent terminology:** Pick one term and use it throughout
- **Cross-skill dependencies:** Each skill should be fully self-contained
- **Overly specific instructions:** Avoid fiddly rules tied to one test case
- **Long SKILL.md without hierarchy:** Use headers, numbered steps, extract detail

---

## 5. Workflows and Feedback Loops

### Complex Tasks Need Checklists

Provide a checklist the agent can copy and check off:
```markdown
Copy this checklist and track your progress:

Task Progress:
- [ ] Step 1: Analyze the form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill the form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)
```

### Feedback Loop Pattern

Run validator → fix errors → repeat. This greatly improves output quality.

### Conditional Workflow Pattern

Guide through decision points with explicit branches:
```markdown
**Creating new content?** → Follow "Creation workflow" below
**Editing existing content?** → Follow "Editing workflow" below
```

### Output Format Templates

When the skill produces structured output, show the expected format with examples:
```markdown
## Output format

**Example structure:**
Branch `feature/foo` (issue #N). Working tree dirty — N files modified.

## What was done
- ...

## Where we left off
- ...
```

---

## 6. Code and Scripts

### Solve, Don't Punt

Handle error conditions explicitly in scripts. If a file isn't found, create it with defaults. Configuration parameters should be justified and documented — no "voodoo constants."

**Good:**
```python
# HTTP requests typically complete within 30 seconds
# Longer timeout accounts for slow connections
REQUEST_TIMEOUT = 30

# Three retries balances reliability vs speed
# Most intermittent failures resolve by the second retry
MAX_RETRIES = 3
```

### Prefer Scripts for Deterministic Operations

Pre-made scripts are more reliable than generated code, save tokens, and ensure consistency. Make clear whether the agent should **execute** the script or **read it as reference**.

### Plan-Validate-Execute Pattern

For complex operations: create intermediate plan file → validate with script → execute. Catches errors before they're applied. Validation scripts should be verbose with specific error messages.

### Package Dependencies Explicitly

List required packages and verify availability. Don't assume tools are installed.

---

## 7. Subagent Prompts

When a skill launches subagents, each agent starts with a blank context. They don't inherit the parent conversation:

- Repeat critical rules in every agent prompt
- Include all necessary context inline (design specs, tokens, templates)
- Be explicit about which tools to use and which to avoid, with **why**
- Include quality standards — the subagent won't inherit them

**Launch strategy:** Use `run_in_background: true` to launch agents immediately while doing setup work in parallel.

---

## 8. Evaluation and Iteration

### Build Evaluations First

Before writing extensive documentation, create three scenarios that test actual gaps:
1. Run Claude on representative tasks without a Skill — document failures
2. Create evaluations that test these gaps
3. Establish baseline performance without the Skill
4. Write minimal instructions that address the gaps
5. Iterate: execute evaluations, compare against baseline, refine

### Develop Iteratively with Claude

Use one instance (Claude A) to create/refine the skill, and another (Claude B) to test it:

1. Complete a task without a skill — notice what context you repeatedly provide
2. Ask Claude A to create a skill capturing that pattern
3. Review for conciseness — remove explanations Claude already knows
4. Improve information architecture — extract schemas/tables to reference files
5. Test on similar tasks with Claude B
6. Observe Claude B's behavior — note where it struggles
7. Return to Claude A with specifics for refinement

### Observe How Claude Navigates Skills

Watch for:
- **Unexpected exploration paths** — structure may not be intuitive
- **Missed connections** — links may need to be more explicit or prominent
- **Overreliance on certain sections** — content may belong in main SKILL.md
- **Ignored content** — files may be unnecessary or poorly signaled

Iterate based on observations, not assumptions.

---

## 9. Pi-Specific Considerations

From [pi.dev/docs/latest/skills](https://pi.dev/docs/latest/skills):

### Locations

Pi loads skills from:
- Global: `~/.pi/agent/skills/`, `~/.agents/skills/`
- Project (trusted): `.pi/skills/`, `.agents/skills/` in cwd and ancestors
- Packages: `skills/` in packages or `pi.skills` entries in `package.json`
- Settings: `skills` array, CLI: `--skill <path>`

### Pi Deviations from the Agent Skills Standard

- Pi does **not** require the name to match the parent directory — useful for shared skill directories used across multiple tools
- Unknown frontmatter fields are ignored
- Most validation issues produce warnings but still load the skill
- **Exception:** Skills with missing description are not loaded

### Extra Frontmatter Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Max 64 chars, lowercase/numbers/hyphens only |
| `description` | Yes | Max 1024 chars. What + when. |
| `license` | No | License name or file reference |
| `compatibility` | No | Max 500 chars. Environment requirements. |
| `metadata` | No | Arbitrary key-value mapping |
| `allowed-tools` | No | Space-delimited pre-approved tools (experimental) |
| `disable-model-invocation` | No | When `true`, skill hidden from system prompt. Must use `/skill:name`. |

### Skill Commands

Skills register as `/skill:name` commands. Enable via `enableSkillCommands: true` in settings.

### Using Skills from Other Harnesses

```json
{
  "skills": ["~/.claude/skills", "~/.codex/skills"]
}
```

For project-level Claude Code skills, add to `.pi/settings.json`:
```json
{
  "skills": ["../.claude/skills"]
}
```

---

## 10. Checklist for Reviewing a Skill

Before sharing or finalizing, verify:

### Description
- [ ] Pushy enough? Includes trigger contexts, not just a summary?
- [ ] Written in third person?
- [ ] Includes both WHAT and WHEN?
- [ ] Tested with 20 eval queries (10 trigger, 10 no-trigger) >80% accuracy?

### SKILL.md Body
- [ ] Under 500 lines?
- [ ] Instructions are reasoned ("because X") rather than rigid ("ALWAYS/NEVER")?
- [ ] Output formats defined with examples?
- [ ] Appropriate degrees of freedom set for each section?
- [ ] Consistent terminology throughout?

### Progressive Disclosure
- [ ] Detail extracted to reference files as needed?
- [ ] File references one level deep only?
- [ ] Reference files >300 lines have table of contents?
- [ ] No `@` imports (only work in CLAUDE.md)?

### Quality
- [ ] Quality expectations repeated at key points, not stated once?
- [ ] Specific anti-patterns named?
- [ ] Workflows have clear, numbered steps with checklists for complex tasks?
- [ ] Feedback loops included for quality-critical tasks?

### Code and Scripts
- [ ] Scripts solve problems rather than punt to Claude?
- [ ] No "voodoo constants" (all values justified)?
- [ ] Error handling is explicit and helpful?
- [ ] Required packages listed and verified?
- [ ] Plan-validate-execute pattern for complex operations?

### Subagents (if used)
- [ ] Critical rules repeated in every agent prompt?
- [ ] All necessary context inline?
- [ ] Quality standards explicitly included?

---

## Sources

- [Anthropic Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Firecrawl: Best Claude Code Skills to Try in 2026](https://www.firecrawl.dev/blog/best-claude-code-skills)
- [Termdock: Good Skill Design Principles](https://termdock.com/blog/good-skill-design-principles)
- [lipex360x: Skill Authoring Guide Gist](https://gist.github.com/lipex360x/3a1a662525e88a3e856b7fda02ab8ce3)
- [Pi Coding Agent: Skills Documentation](https://pi.dev/docs/latest/skills)
- [Anthropic: The Complete Guide to Building Skills for Claude (PDF)](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)