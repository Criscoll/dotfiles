---
name: resync
description: Reconcile this machine's dotfiles with the repo — inventory, diff, classify, plan, and apply changes one phase at a time
disable-model-invocation: true
allowed-tools: Bash Read Write Glob Grep Edit
---

You are running the dotfiles resync skill. Work through **one phase at a time** — the orchestration script outputs only the prompt for the current phase, keeping your context focused.

## Start

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --phase 0
```

## After each phase

Use the routing table to find the next phase, then fetch and execute it:

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route <current_phase> <condition>
python3 ${CLAUDE_SKILL_DIR}/resync.py --phase <next_phase>
```

Each phase file tells you exactly which condition to report when it's done. Follow it.
