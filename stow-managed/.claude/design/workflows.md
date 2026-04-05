# Efficient Claude Code Workflows

Source: Boris Tane (Engineering Lead, Cloudflare) — https://boristane.com/blog/how-i-use-claude-code/

---

## Core Philosophy

Separate **thinking** (research + planning) from **typing** (implementation). Never let Claude write code until a written plan has been reviewed and approved. This prevents wasted effort and preserves architectural control.

---

## The Research → Plan → Implement Loop

### Phase 1: Research

Direct Claude to read the relevant codebase sections deeply before doing anything else.

- Use emphatic language: "deeply", "thoroughly", "understand the intricacies of" — this prevents surface-level skimming
- Require findings to be written to a persistent markdown file (not just stated in the chat)
- Review the research output before proceeding — catch misunderstandings early, before they cascade

Example prompt:
> "Read this folder in depth, understand how it works deeply... write a detailed report of your learnings."

---

### Phase 2: Planning

Have Claude produce a full implementation plan as a markdown file — **not** using Claude's built-in plan mode.

- The plan file should include: detailed explanations, relevant code snippets, exact file paths, and trade-offs
- If there are relevant open-source implementations, point Claude at them to guide its approach
- Store plans in the repo for full version control and cross-session persistence

#### The Annotation Cycle (the critical differentiator)

After Claude generates the plan:
1. Add inline notes directly into the plan document
2. Notes can: correct assumptions, reject approaches, inject domain constraints, encode product priorities
3. Ask Claude to revise the plan based on your notes — **with an explicit "do not implement yet" guard**
4. Repeat 1–6 times until the plan is system-specific and reflects real engineering trade-offs

This shared mutable document becomes the precise interface between human judgment and AI execution. It allows holistic review before any code is written.

---

### Phase 3: Implementation

Once the plan is locked, use a single directive to execute everything:

> "Implement it all... mark tasks as completed as you go... do not stop until all tasks are completed... continuously run typecheck."

Key constraints to enforce in this prompt:
- Execute everything in the plan — no cherry-picking
- Strict typing — no `any` or `unknown`
- Minimal comments — keep code clean
- Run type-checking continuously throughout

---

## During Implementation: Supervisory Mode

Once implementation begins, shift to short, directive corrections:

- Reference existing patterns: *"This table should look exactly like the users table"*
- Use screenshots for visual/layout issues
- When an approach goes wrong: revert and re-scope rather than patching
- Give item-level decisions on any changes Claude proposes
- Actively trim scope — prevent feature creep by cutting proposals that exceed what was planned

Hard constraints to state upfront:
- Protect existing interfaces (don't let Claude refactor things it wasn't asked to touch)
- Override technical choices when domain knowledge dictates

---

## Session Structure

Conduct research, planning, and implementation in **one continuous session** where possible. Persistent plan files (markdown in the repo) survive context-window compaction — the session can be resumed without loss of intent.

---

## Key Takeaways for Config / CLAUDE.md Design

- CLAUDE.md should encode hard constraints and conventions upfront — Claude respects these as standing instructions
- Persistent markdown files (plans, research notes) are more reliable than relying on context window retention
- "Do not implement yet" is a useful explicit guard phrase when iterating on plans
- Emphatic language in prompts genuinely changes depth of analysis — worth encoding in CLAUDE.md instruction style
