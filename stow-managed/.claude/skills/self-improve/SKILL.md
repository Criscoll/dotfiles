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

### A. New skills
- Was a workflow repeated more than once that could be codified?
- Was a multi-step task explained from scratch that a skill prompt would have handled?
- Is there a recurring pattern that always needs the same context to get right?

For each candidate: name the skill, one-sentence purpose, and the trigger phrases that would invoke it.

### B. Gaps in existing skills
- Was a skill invoked but needed extra clarification mid-run?
- Did a skill miss a step, edge case, or convention that had to be corrected?
- Was a skill used in a way that its current description doesn't capture?

For each: name the skill, what was missing, and what to add or change.

### C. Missed skill triggers
- Was there a moment where a skill existed but wasn't invoked — and the work was done manually instead?
- Does a skill's `description` field not match the natural language the user actually used?

For each: name the skill, the phrase that should have triggered it, and the description change needed.

### D. Hook and script opportunities
- Was there a repetitive pre/post action that the harness could automate via a hook?
- Was there a shell command run before or after every tool call of a certain type?
- Was there a check that had to be done manually each time (lint, stow simulate, git status)?

For each: describe the hook event, the command it would run, and the setting it would live in (user-level `~/.claude/settings.json` vs project-level `.claude/settings.json`).

### E. CLAUDE.md improvements
- Was a convention explained in the conversation that isn't in any CLAUDE.md?
- Was there a decision or constraint that will need to be re-explained in future sessions?
- Is there a directory or project that would benefit from a scoped CLAUDE.md it doesn't currently have?

For each: state which CLAUDE.md to update (global `~/.claude/CLAUDE.md`, repo-root `.claude/CLAUDE.md`, or a new scoped file), and draft the text to add.

## Output format

```
## Session Improvement Report

### New Skills
- **<skill-name>**: <purpose>. Triggers: "<phrase 1>", "<phrase 2>".
  [or: none identified]

### Gaps in Existing Skills
- **<skill-name>**: <what was missing> → <proposed fix>
  [or: none identified]

### Missed Skill Triggers
- **<skill-name>**: user said "<phrase>" but skill wasn't invoked → add "<phrase>" to description
  [or: none identified]

### Hook / Script Opportunities
- **<hook-event>**: run `<command>` — lives in <settings file>
  [or: none identified]

### CLAUDE.md Improvements
- **<which file>**: <what to add and why>
  [or: none identified]
```

## Rules

- Only surface findings with a real signal from this session. Do not speculate.
- Do not implement anything without explicit user approval.
- If the session was short or unremarkable, say so clearly rather than padding the report.
- Be specific: vague suggestions ("improve error handling") are useless. Name the skill, the phrase, the line to add.
