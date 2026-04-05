# Skill Architecture Patterns

Reference for designing and extending Claude Code skills in this repo.

---

## Skills vs Commands

Skills (`~/.claude/skills/<name>/SKILL.md`) are the preferred extension mechanism. They support everything commands do (invocable via `/<name>`) plus:

- Supporting files and scripts in the skill directory
- `${CLAUDE_SKILL_DIR}` variable for referencing those files
- Frontmatter control: invocation mode, tool allowlist, model, subagent forking
- Automatic loading based on description match (disable with `disable-model-invocation: true`)

Use `skills/` for all new additions. `commands/` is legacy.

---

## Frontmatter Conventions

```yaml
---
name: skill-name
description: One sentence — used by Claude to decide when to auto-load this skill
disable-model-invocation: true   # For skills with side effects — only invoke explicitly
allowed-tools: Bash Read Write Glob Grep Edit
---
```

- Set `disable-model-invocation: true` for any skill that modifies the filesystem, runs stow, or has other side effects. Without this, Claude may trigger it based on topic similarity alone.
- `allowed-tools` grants access without per-use prompts while the skill is active.

---

## The Phased Orchestration Pattern

For complex, multi-step workflows, avoid putting the entire runbook in a single skill file. A long prompt:
- Fills the context window with instructions that aren't relevant to the current step
- Causes drift — the agent loses track of where it is
- Makes it hard to pause, review, and resume at a specific point

**The pattern:** split the workflow into numbered phase files, with a Python orchestration script that acts as a router.

### Structure

```
skills/<name>/
├── SKILL.md          # Entry point — instructs Claude to start at phase 0
├── orchestrate.py    # Routing script: --phase N, --route PHASE CONDITION
└── phases/
    ├── phase_0.md    # Orientation / setup
    ├── phase_1.md    # First phase
    ├── ...
    └── phase_end.md  # Completion summary
```

### How it works

`SKILL.md` tells Claude to run `python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --phase 0` to get the first prompt. Each phase file is self-contained and ends with a routing call:

```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route <current_phase> <condition>
```

The script prints the next phase ID. Claude then fetches and executes it:

```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --phase <next>
```

### The routing table

The script holds the full state machine as a dictionary:

```python
ROUTING = {
    ("1", "clean_slate"):    "5",   # skip phases 2-4
    ("1", "has_local_files"): "2",
    ("6", "approved"):       "7",
    ("6", "needs_revision"): "5",   # loop back
    ("7", "done"):           "end",
    ("7", "sensitive_blocked"): "end",
}
```

Conditions are meaningful strings that the phase file instructs Claude to report. Invalid routes produce an error listing valid conditions for the current phase — useful when writing new phases.

### Result

- Each phase gets a focused, minimal prompt
- State transitions are explicit and auditable in one place
- The workflow can be paused at any phase boundary and resumed cleanly
- Adding a new branch is a single routing table entry + a new phase file

---

## Cross-Machine Path Resolution

Skills that touch the filesystem must never hardcode paths. Home directories and repo locations differ across machines.

**Pattern for phase 0 of any filesystem skill:**

1. Resolve the home directory: `realpath ~`
2. Probe common repo locations (check for a known marker like `stow-managed/`)
3. Present findings to the user and ask for confirmation
4. Write confirmed paths to a persistent working file (e.g. `/tmp/<skill>-audit.md`):
   ```
   HOME_DIR=/home/username
   REPO_DIR=/home/username/Repos/dotfiles
   ```
5. Every subsequent phase reads these values from the working file before running any commands

This makes the skill portable without needing env vars or config files, and the explicit confirmation step surfaces wrong assumptions before any work begins.
