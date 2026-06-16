# Agent Planning Methodologies — A Survey

Synthesised June 2026. Covers the major planning-before-execution patterns for coding
agents (Claude Code, Cursor, Copilot, etc.). The goal: identify what the best
practitioners converge on, what they disagree about, and what a reliable
personal workflow might look like.

**Related inspiration:** Mario Zechner's
[_"What if you don't need MCP?"_](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)
— the harness (system prompt, rules, tools) matters more than MCP bling. All
the patterns below are harness design in disguise.

---

## The Five Pattern Families

### 1. RPI — Research → Plan → Implement (Boris Tane)

**Source:** ["How I Use Claude Code"](https://boristane.com/blog/how-i-use-claude-code) (Feb 2026)

Boris Tane is Engineering Lead at Cloudflare. He's been using Claude Code as his
primary dev tool for 9+ months. His core principle:

> **Never let Claude write code until you've reviewed and approved a written plan.**

```
Research → Plan → [Annotation cycle 1–6x] → Todo List → Implement → Feedback
```

**Phase details:**

- **Research:** Directive uses loaded language — _"read this folder in depth,
  understand how it works deeply, all its specificities"_. Output is `research.md`.
  This is the review surface: you verify Claude actually understood the system
  before planning starts. Prevents implementations that work in isolation but
  break the surrounding system.

- **Plan:** Asks for a `plan.md` with approach, code snippets, file paths, and
  trade-offs. Uses raw `.md` files, not Claude Code's built-in plan mode ("it
  sucks"). The key reason: a real file is **shared mutable state** between you
  and the agent.

- **Annotation cycle (the differentiator):** You open `plan.md` in your editor
  and add inline notes. _"Use drizzle:generate for migrations, not raw SQL"_,
  _"This should be a PATCH, not a PUT"_, _"Remove this section entirely, we
  don't need caching"_. Then: _"I added notes, address them and update the
  document — don't implement yet"_. Repeats 1–6 times. The **"don't implement
  yet"** guard is essential.

- **Todo list:** Before implementation: _"add a detailed todo list to the plan,
  all phases and individual tasks"_. Serves as progress tracking during execution.

- **Implementation:** Standard prompt: _"implement it all. mark tasks as
  completed in the plan. do not stop until all phases are completed. no
  unnecessary comments or JSDoc. no `any` or `unknown` types. continuously
  run typecheck."_

**Session strategy:** Single long session for research + planning +
implementation. Boris doesn't see the context-window degradation others
report — auto-compaction maintains enough context, and the `plan.md` survives
compaction in full fidelity.

**Key quote:** "I want implementation to be boring. The creative work
happened in the annotation cycles."

---

### 2. RPA — Refine → Plan → Act (Francesco Borzì)

**Source:** ["The Refine-Plan-Act Pattern for Agentic AI Coding"](https://medium.com/@borzifrancesco/the-refine-plan-act-pattern-for-agentic-ai-coding-59ee013e4427) (May 2026)

Inspired by Boris Tane but diverges on session strategy. Borzì adds an explicit
**Refine phase** before planning and always starts fresh sessions between phases.

```
TICKET.md → [Refine → REQUIREMENTS.md] → [Plan → PLAN.md] → [Act → Implementation]
  ↑ Fresh session              ↑ Fresh session              ↑ Fresh session
```

**Phase details:**

- **Refine:** Validates the original ticket against the actual codebase. Converts
  a potentially ambiguous/poorly-written `TICKET.md` into a clean, verified
  `REQUIREMENTS.md`. Prompt: _"Analyze the ticket. Check the current code.
  Verify instructions make sense and are compatible. If unclear, ASK questions.
  Output a new REQUIREMENTS.md that a fresh agent can pick up. Do NOT implement."_

- **Plan:** Takes `REQUIREMENTS.md`, adds technical decisions, outputs `PLAN.md`.
  This is where architecture happens: refactor vs. reuse, which API to call,
  what tests to write, file/folder structure.

- **Act:** Takes `PLAN.md`, implements, runs format/lint/test/build, fixes
  failures.

**Key benefits Borzì claims:**

- **Better results:** Each phase has a lean, single-concern context. Complex
  tasks degrade quickly when refine+plan+code all share one context window.
- **Early review:** Catch requirement misunderstandings in `REQUIREMENTS.md`,
  architectural mistakes in `PLAN.md` — both before any code is written.
- **Parallelism:** Refine and Plan are read-only — you can run multiple agents
  on different tickets simultaneously.
- **Cheap retries:** If Act goes wrong, throw away the code, tweak `PLAN.md`,
  re-run. The thinking is preserved separately from the code.
- **Auditability:** Ask a fresh agent to validate any artifact against its
  predecessor (`PLAN.md` vs `REQUIREMENTS.md`, implementation vs `PLAN.md`).
- **Model arbitrage:** Use expensive models for Refine/Plan, cheaper models for Act.

**When he skips Refine:** Only for extremely simple tasks ("add unit test
coverage for this class", "rename this method everywhere").

---

### 3. Spec-Driven Development (Addy Osmani / GitHub Spec Kit)

**Sources:**
- ["How to write a good spec for AI agents"](https://addyosmani.com/blog/good-spec/) (Jan 2026)
- ["My LLM coding workflow going into 2026"](https://addyosmani.com/blog/ai-coding-workflow/)
- [GitHub Spec Kit](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)

Addy Osmani (Google, working on Gemini/Chrome) advocates treating specs as
**executable artifacts** — the spec is the source of truth that drives
implementation, not a document you write and discard.

**Five principles:**

1. **Start high-level, let AI draft details.** Write a "product brief" and let
   the agent generate the full spec. The spec becomes the first artifact you
   and the AI build together.
2. **Structure like a PRD.** Six core areas every good spec covers:
   - Commands (full commands with flags)
   - Testing (framework, file locations, coverage expectations)
   - Project structure (where source/tests/docs live)
   - Code style (real snippets beat paragraphs)
   - Git workflow (branch naming, commit format, PR process)
   - Boundaries (three-tier: ✅ Always / ⚠️ Ask first / 🚫 Never)
3. **Break into modular prompts.** Don't dump the full spec into one prompt.
   Use per-task context, spec summaries/TOCs, and optionally sub-agents for
   different domains. Research confirms the "curse of instructions" — more
   directives in one prompt → fewer are followed.
4. **Build in self-checks.** Instruct the agent to verify its output against the
   spec. Use "LLM-as-a-Judge" for subjective criteria (style, readability) and
   conformance test suites for objective criteria (expected inputs/outputs).
5. **Test, iterate, evolve.** Specs are living documents updated continuously.
   Version the spec in git alongside the code.

**GitHub Spec Kit gated workflow:**
```
Specify → Plan → Tasks → Implement
```
- **Specify:** What and why — user journeys, success criteria
- **Plan:** How — tech stack, architecture, constraints
- **Tasks:** Break into small, reviewable, independently testable chunks
- **Implement:** Code task by task with verification gates at each step

**Key quote:** "Vague prompts mean wrong results. Be specific about inputs,
outputs, and constraints."

---

### 4. Tool-Embedded Planning (Cursor Plan Mode)

**Source:** [Cursor blog: "Best Practices for Coding with Agents"](https://cursor.com/blog/agent-best-practices) (Jan 2026)

Cursor popularised "plan mode" as a named, toggleable feature (Shift+Tab). It
decouples reasoning from execution within the same tool.

```
Shift+Tab → Agent researches codebase → Asks clarifying questions
         → Creates detailed plan (Markdown) → You review/edit → Click to build
```

**Key features:**

- Plans open as editable Markdown — you can remove steps, adjust approach, add
  context the agent missed
- "Save to workspace" stores plans in `.cursor/plans/` for team sharing,
  resuming interrupted work, and future agent context
- **Start over from plan, not from prompt:** When the agent builds something
  wrong, revert changes, refine the plan, and re-run. Faster than patching
  mid-stream.
- **Two-model strategy** (from Subramanya): Plan with Opus (expensive,
  architectural), execute with Sonnet/GPT (cheaper, fast). _"Separates the
  'what' from the 'how' and gives you a reviewable artifact."_

**When to skip:** Quick changes, tasks you've done many times before.

---

### 5. SFAD — Spec-First Agentic Development (Massimiliano Conti)

**Source:** [shared-knowledge/sfad](https://github.com/massimilianoC/shared-knowledge/blob/main/knowledge/sfad/patterns/SPEC_FIRST_AGENTIC_DEVELOPMENT.md) (May 2026)

The heavyweight methodology. Designed for multi-agent, multi-human teams on
projects expected to run > 1 week. Distilled from a real production codebase
(Beehouse Admin Dashboard: React + TS + Zod + IoT + AI).

**Five pillars:**

| # | Pillar | Meaning |
|---|---|---|
| 1 | Spec-first | Vision → Architecture → Requirements → Roadmap → Execution Spec exist as Markdown before any `src/` |
| 2 | Agent contract | Single `AGENTS.md` binds all assistants; per-tool aliases defer to it |
| 3 | Layered stability | Every doc declares `Stability: stable \| evolving \| draft` |
| 4 | Doc-driven workflow | Fixed reading order; doc updates are part of Definition of Done |
| 5 | Vertical micro-slices | No "infrastructure-only" sprints; all milestones deliver user-visible value |

**The binding 12 non-negotiables:** Spec before code, single AGENTS.md contract,
declared stability, explicit SSOT, schema-driven boundaries, idempotent
mutations, observable long-running work, server-side RBAC, audit as feature,
forward-compatible schemas, no secrets in client, vertical micro-slices.

**7-step workflow per task:**
```
Plan → Read Context → Schema First → Implement → Test → Verify → Document
```

**When SFAD is overkill:** 1–2 day spikes, solo experiments. Collapses to
`AGENTS.md` + `README.md` + one-milestone `ROADMAP.md` for small projects.

---

### Related: Microsoft Agentic-Agile

**Source:** [Microsoft blog](https://developer.microsoft.com/blog/agentic-agile-why-agent-development-needs-agile-not-just-prompts) (May 2026)

```
Plan → Issue → Implement → Review → Merge → Docs
```

Shares SFAD's DNA: structured issues with acceptance criteria, agent
instructions as persistent `.github/copilot-instructions.md` / `CLAUDE.md`,
documentation as a required step in every cycle. Treats agents as **team
contributors, not tools** — every agent action is a development action with
the same downstream consequences as a human commit.

---

## Convergence: What Everyone Agrees On

| Principle | Who says it |
|---|---|
| **Plan before code.** Never skip this. | Boris, Borzì, Addy, Cursor, SFAD, Microsoft |
| **Persistent artifacts (Markdown files).** Plans survive context clears, compaction, and you can edit them. | Boris, Borzì, Addy, Cursor, SFAD |
| **Human review at phase boundaries.** Catch architectural mistakes when they cost nothing. | Boris (annotation cycle), Borzì (artifact review), Addy (spec review), SFAD (stability gates) |
| **Revert and re-plan, don't patch.** If the output is wrong, discard the code, refine the plan, re-run. | Boris, Cursor |
| **Explicit boundaries (Always/Ask/Never).** Tell the agent what NOT to do. | Addy (three-tier), SFAD (12 non-negotiables) |
| **Tests are force multipliers.** Agents with test suites iterate autonomously. Without tests, they produce confident garbage. | Addy, Boris, SFAD, Cursor |
| **Small chunks, not monoliths.** Break work into focused tasks. "Curse of instructions" is real. | Addy, Borzì, Boris |
| **The spec/plan is the SSOT.** The document outlives the chat session. | All |

---

## Divergence: Where They Disagree

| Dimension | Boris (RPI) | Borzì (RPA) | Addy (Spec-Driven) | SFAD | Cursor |
|---|---|---|---|---|---|
| **Session strategy** | One long session | Fresh session per phase | Fresh session per task | Fresh session per phase | Per plan or per task |
| **First phase** | Research (deep codebase study) | Refine (validate ticket vs. codebase) | High-level vision → AI drafts spec | Vision + Architecture docs first | Agent researches codebase |
| **Artifact format** | `research.md` + `plan.md` | `REQUIREMENTS.md` + `PLAN.md` | `SPEC.md` (6-area PRD) | Full `docs/` stack | `.cursor/plans/*.md` |
| **Review mechanism** | Annotation cycle on plan.md | Review at each artifact boundary | Spec review + self-checks | Stability gates + 7-step verify | Edit plan + click-to-build |
| **Model strategy** | Same throughout | Different models per phase | Different models per task | Not specified | Opus→plan, Sonnet→execute |
| **Weight** | Light | Medium | Medium | Heavy | Light (tool-managed) |
| **Multi-agent ready?** | No (single session) | Yes (parallel Refine/Plan) | Yes (sub-agents) | Yes (explicitly designed for it) | Partial (Custom Commands) |

---

## Choosing Your Approach

```
Use SFAD if:
  - Project > 1 week, multiple contributors (human or AI)
  - You need team governance and onboarding
  - You want a complete methodology with templates

Use Addy's Spec-Driven if:
  - You want structure without the full SFAD doc stack
  - The 6-area PRD checklist resonates with you
  - You build different types of projects and need flexibility

Use RPA (Borzì) if:
  - You work from tickets/issues with potentially ambiguous requirements
  - You want clean context separation between phases
  - You value being able to parallelise planning across tickets

Use RPI (Boris) if:
  - You prefer long, uninterrupted sessions
  - You want maximum human agency via the annotation cycle
  - Your workflow is mostly single-feature, deep-work style
  - The edit-plan-in-your-IDE loop appeals to you

Use Cursor Plan Mode if:
  - You're in the Cursor ecosystem
  - You want tool-managed planning with minimal overhead
  - Your tasks are moderate complexity

Use no formal planning only if:
  - Purely trivial tasks (typo fixes, single-line changes)
  - Throwaway prototypes / exploration
```

---

## Building a Personal Synthesis

The strongest elements to borrow from each pattern:

| From | Steal this |
|---|---|
| **Boris (RPI)** | Annotation cycle on a real `.md` file; the "don't implement yet" guard; standardised implementation prompt; single long session for flow |
| **Borzì (RPA)** | Explicit Refine phase that validates the ticket against the codebase; fresh sessions per phase; the ability to throw away bad code but keep the plan |
| **Addy (Spec-Driven)** | The 6-area PRD checklist; three-tier boundaries (Always/Ask/Never); spec-as-executable-artifact; single-file `SPEC.md` as SSOT |
| **SFAD** | `AGENTS.md` as binding contract; `Stability:` tags on docs; doc updates as part of Definition of Done; vertical micro-slices |
| **Cursor** | Plan files saveable to workspace for team context; two-model strategy (expensive for planning, cheap for execution); "start over from plan, not prompt" |
| **Mario Zechner** | Focus on the harness, not the bells and whistles; context engineering > tool proliferation |

---

## A Potential Unified Workflow

For a personal/claude-code-centric setup, combining the best of these:

```
1. SPEC / REFINE
   - If working from a ticket: validate against codebase → REQUIREMENTS.md
   - If greenfield: write high-level vision → agent drafts SPEC.md
   - Cover the 6 areas: Commands, Testing, Structure, Style, Git, Boundaries

2. RESEARCH
   - Deep-read relevant codebase areas → research.md
   - Verify: does the agent actually understand the existing system?

3. PLAN
   - Detailed PLAN.md with code snippets, file paths, trade-offs
   - Annotation cycle: edit plan.md in IDE → "address notes, don't implement" → repeat 1-4x
   - Add granular todo list at the end

4. IMPLEMENT
   - "Implement it all. Mark phases complete. Continuously run typecheck + tests."
   - If it goes wrong: revert, refine PLAN.md, re-run

5. REVIEW & DOCUMENT
   - Verify: typecheck && lint && test && build all green
   - Update SPEC.md / PLAN.md with any changes discovered during implementation
   - Commit plan artifacts alongside code
```

---

## References

- Boris Tane — [How I Use Claude Code](https://boristane.com/blog/how-i-use-claude-code)
- Francesco Borzì — [The Refine-Plan-Act Pattern](https://medium.com/@borzifrancesco/the-refine-plan-act-pattern-for-agentic-ai-coding-59ee013e4427)
- Addy Osmani — [How to write a good spec for AI agents](https://addyosmani.com/blog/good-spec/)
- Addy Osmani — [AI coding workflow going into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- Cursor — [Best Practices for Coding with Agents](https://cursor.com/blog/agent-best-practices)
- SFAD — [Spec-First Agentic Development](https://github.com/massimilianoC/shared-knowledge/blob/main/knowledge/sfad/patterns/SPEC_FIRST_AGENTIC_DEVELOPMENT.md)
- SFAD — [Doc-Driven Agentic Workflow](https://github.com/massimilianoC/shared-knowledge/blob/main/knowledge/sfad/patterns/DOC_DRIVEN_AGENTIC_WORKFLOW.md)
- Microsoft — [Agentic-Agile](https://github.com/microsoft/agentic-agile-template)
- Microsoft HVE Core — [RPI Workflow](https://microsoft.github.io/hve-core/docs/rpi/)
- Subramanya — [A Year with Cursor](https://subramanya.ai/2026/01/04/a-year-with-cursor-how-my-workflow-evolved-from-agent-to-architect/)
- Mario Zechner — [What if you don't need MCP?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)
