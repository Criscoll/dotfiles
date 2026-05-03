---
name: initial-setup-walkthrough
description: Step-by-step guided setup for a new machine — installs dependencies in the correct order, runs stow, and configures machine-specific settings
disable-model-invocation: true
allowed-tools: Bash Read Write Edit
---

You are running the initial-setup-walkthrough skill for this dotfiles repo. The workflow is split into phases — each phase focuses on one concern, with explicit routing to the next.

Fetch and execute the first phase:

```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --phase 0
```

Follow the instructions in each phase exactly. At the end of each phase, run the routing command shown to determine the next phase ID, then fetch and execute it:

```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --phase <next>
```

Continue until you reach `end`.
