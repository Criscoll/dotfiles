---
name: self-improve
description: Reflect on the current session to identify improvements — new skill ideas, gaps in existing skill prompts, missed skill triggers, hook/script opportunities, and CLAUDE.md additions. Use when the user says "self-improve", "reflect on this session", "what can we improve", "capture this workflow", or "update our tooling based on today".
disable-model-invocation: false
---

You are running the self-improve skill. Your job is to audit this session and produce concrete, actionable improvements to the tooling and instructions that govern future sessions. You are not implementing anything — you are identifying what should change and why.

## What the user gave you

`$ARGUMENTS` may name a specific area to focus on (e.g. "skills", "hooks", "CLAUDE.md"). If absent, audit everything.

## Steps

1. **Scan the session.** Review the full conversation: what tasks were attempted, what tools were called, what friction arose, what workarounds were needed, what decisions had to be re-explained.

2. **Assess each improvement area** (see below). For each, note findings only if there is a real signal — do not manufacture suggestions.

3. **Produce the report** inline in your response. Do not create files. Do not apply changes. Summarize each finding as a proposed action the user can approve.

4. **Offer to act.** After the report, ask the user which items to implement now (e.g. "I can create the skill, update the CLAUDE.md, or draft the hook — which should I do?").

## Improvement areas

For each area, the goal is not just to propose a fix — it is to capture *why* the fix is necessary. Ask yourself: what happened in the session? What did the current tooling fail to handle? Why does the proposed change address that root cause? If the solution isn't clear yet, say so and document the problem precisely instead.

### A. New skills
- Was a workflow repeated more than once that could be codified?
- Was a multi-step task explained from scratch that a skill prompt would have handled?
- Is there a recurring pattern that always needs the same context to get right?

For each candidate: name the skill, what session event revealed the need, what the skill would have done differently, and the trigger phrases that would invoke it.

### B. Gaps in existing skills
- Was a skill invoked but needed extra clarification mid-run?
- Did a skill miss a step, edge case, or convention that had to be corrected?
- Was a skill used in a way that its current description doesn't capture?

For each: name the skill, what specifically went wrong (quote the moment if possible), why the current prompt didn't handle it, and what to add or change.

### C. Missed skill triggers
- Was there a moment where a skill existed but wasn't invoked — and the work was done manually instead?
- Does a skill's `description` field not match the natural language the user actually used?

For each: name the skill, the exact phrase that should have triggered it, why the description didn't match, and the change needed.

### D. Hook and script opportunities
- Was there a repetitive pre/post action that the harness could automate via a hook?
- Was there a shell command run before or after every tool call of a certain type?
- Was there a check that had to be done manually each time (lint, stow simulate, git status)?

For each: describe what was done manually, why it was tedious or error-prone, the hook event and command it would run, and the setting it would live in (user-level `~/.claude/settings.json` vs project-level `.claude/settings.json`).

### E. CLAUDE.md improvements
- Was a convention explained in the conversation that isn't in any CLAUDE.md?
- Was there a decision or constraint that will need to be re-explained in future sessions?
- Is there a directory or project that would benefit from a scoped CLAUDE.md it doesn't currently have?

For each: state which CLAUDE.md to update (global `~/.claude/CLAUDE.md`, repo-root `.claude/CLAUDE.md`, or a new scoped file), what had to be explained manually, why it will recur, and draft the text to add.

## Output format

Each item must answer four questions. If the solution is not yet clear, replace the last two with a precise problem statement and flag it as open.

```
## Session Improvement Report

### New Skills
- **<skill-name>**
  - Problem: <what happened in the session that revealed this gap>
  - Shortcoming: <why the current tooling didn't handle it>
  - Proposed fix: <what the skill would do; triggers: "phrase 1", "phrase 2">
  - Why it helps: <how this addresses the root cause>
  [or: none identified]

### Gaps in Existing Skills
- **<skill-name>** (`<file path>`)
  - Problem: <what went wrong mid-session>
  - Shortcoming: <what the current prompt is missing>
  - Proposed fix: <exact addition or change>
  - Why it helps: <why this prevents the same gap next time>
  [or: none identified]

### Missed Skill Triggers
- **<skill-name>**
  - Problem: <what was done manually instead>
  - Shortcoming: <why the description didn't fire>
  - Proposed fix: add "<phrase>" to description
  - Why it helps: <why this phrase reliably signals the skill is needed>
  [or: none identified]

### Hook / Script Opportunities
- **<hook-event>**
  - Problem: <what was done manually each time>
  - Shortcoming: <why this is error-prone or tedious without automation>
  - Proposed fix: run `<command>` — lives in <settings file>
  - Why it helps: <what it catches or saves>
  [or: none identified]

### CLAUDE.md Improvements
- **<which file>** (`<absolute path>`)
  - Problem: <what had to be explained or re-derived in this session>
  - Shortcoming: <why it wasn't already in the docs>
  - Proposed fix: <draft text to add>
  - Why it helps: <how this prevents re-explanation in future sessions>
  [or: none identified]
```

## Rules

- Only surface findings with a real signal from this session. Do not speculate.
- Do not implement anything without explicit user approval.
- If the session was short or unremarkable, say so clearly rather than padding the report.
- Be specific: vague suggestions ("improve error handling") are useless. Name the skill, quote the moment, name the line to change.
- If the solution is genuinely unclear, write "solution open" and document the problem precisely — a clear problem statement is more useful than a half-baked fix.
- **For repo-specific action items** (skill gaps, CLAUDE.md edits, file changes scoped to a project), always include the **full absolute path** to the file — e.g. `/home/cristian/Repos/spreadsheets/CLAUDE.md`, not just "the repo CLAUDE.md". An agent acting on the report may be invoked from a different working directory and needs the path to locate the file without searching.
- **When writing output files to `/tmp/`**, name them `self-improve-<context>.<ext>` — e.g. `self-improve-python-knowledge-SKILL.md`. This makes self-improve outputs identifiable and prevents collisions with unrelated temp files.
