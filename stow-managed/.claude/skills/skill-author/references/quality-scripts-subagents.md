# Quality, Scripts, and Subagents

Load this when the skill you're authoring runs a multi-step workflow, ships scripts,
or spawns subagents. Covers workflow patterns, script/dependency conventions (tied
to this repo's tooling), and how to write subagent prompts.

## Workflow patterns

For skills whose job is a procedure (not just knowledge), give the model structure
it can execute and self-check against.

**Copy-able checklist** — for multi-step tasks where skipping a step causes silent
failure. Tell the model to copy it and tick items off:
```markdown
Copy this checklist and track progress:
- [ ] Analyze the form (run analyze_form.py)
- [ ] Create field mapping (edit fields.json)
- [ ] Validate mapping (run validate_fields.py)
- [ ] Fill the form (run fill_form.py)
- [ ] Verify output (run verify_output.py)
```

**Validator feedback loop** — for quality-critical output: run a validator → fix the
reported errors → re-run, until clean. The loop beats a single best-effort pass.

**Conditional branches** — when the path forks, route explicitly rather than burying
it in prose:
```markdown
**Creating new content?** → follow the Creation workflow.
**Editing existing content?** → follow the Editing workflow.
```

**Output-format template** — when the skill emits structured output, show the exact
shape with a filled example so every run looks the same:
```markdown
## Output format
Branch `feature/foo` (issue #N). Working tree dirty — N files modified.
## What was done
- …
## Where we left off
- …
```

## Token-efficiency wrapper pattern

When a skill drives a CLI tool or external API whose output is noisy, nested, or
requires multi-step parsing, extract a wrapper script rather than leaving the agent
to re-derive the extraction logic each session.

**Signs a skill needs a wrapper:**
- The skill shows agents a Python heredoc or jq chain just to decode the output.
- Multiple sessions would re-discover the same JSON structure through trial and error.
- The raw output has a security wrapper, encoding layer, or high-noise fields
  (warnings, metadata) the agent doesn't need.
- A session analysis reveals 2+ tool calls spent just figuring out how to read the data.

**Wrapper design rules:**
- One clear job per script — don't bundle unrelated operations.
- Pipe-friendly flat output: one record per line, fields separated by ` | `, so the
  agent can read results without further parsing.
- Accept a `--limit N` flag on any script that returns potentially large bodies
  (default 500–2000 chars; `0` = no truncation).
- Print a usage error and exit 2 when required args are absent.
- Print "No results found." and exit 0 when the query succeeds but returns nothing
  (distinguish from errors).
- Scripts live in `stow-managed/bin/agent_scripts/` and are referenced by full path.
- Update the skill's reference docs to use the wrapper; remove or demote the raw
  CLI examples so agents reach for the wrapper first.

**Existing examples to follow:**
- `~/bin/agent_scripts/gmail-list`, `gmail-read`, `gmail-search` — strip gws-cli's
  security-warning JSON wrapper; output flat `id | date | from | to | subject | snippet`.
- `~/bin/agent_scripts/pi-session-info`, `pi-session-tools`, `pi-session-chat`,
  `pi-session-decode` — decode pi's base64-HTML format; handle two toolResult variants.

**When reviewing an existing skill**, ask: "Could an agent spend 2+ tool calls just
reading and parsing the raw output?" If yes, a wrapper is warranted.

## Scripts and dependencies

Prefer a checked-in script over generated code for any deterministic, repeated
operation: it's more reliable, costs fewer tokens, and behaves identically every
run. State clearly whether the agent should **execute** the script or **read it as
reference**.

- **Solve, don't punt.** Handle the error conditions in the script. If a file is
  missing, create it with defaults rather than bailing to the agent. Validation
  scripts should print specific, actionable error messages.
- **No voodoo constants.** Every magic number gets a one-line justification:
  ```python
  # HTTP requests typically finish within 30s; the longer bound covers slow links
  REQUEST_TIMEOUT = 30
  ```
- **Declare dependencies — this repo's way.** Never assume a library is globally
  installed; the repo must be self-describing so a fresh machine can onboard by
  reading it.
  - **Python** → PEP 723 inline metadata, run via `uv`. Pin exact versions (`==`),
    never `>=`/`~=`:
    ```python
    #!/usr/bin/env -S uv run --script
    # /// script
    # requires-python = ">=3.10"
    # dependencies = ["playwright==1.60.0"]
    # ///
    ```
  - **Node** → a `package.json` (+ `package-lock.json`) in the script's directory with
    exact versions (no `^`/`~`); onboard with `npm ci`, not `npm install`.
  - Agent-only scripts belong in `stow-managed/bin/agent_scripts/` and are referenced
    by full path (`~/bin/agent_scripts/<name>`).
- **Portability.** Targets are Linux (primary) and macOS (read-only). Avoid GNU-only
  flags (`readlink -f`, `stat -c`); fall back to `python3` when no portable
  equivalent exists.

## Subagent prompts

A spawned subagent starts with a blank context — it inherits none of the parent
conversation. Everything it needs must be in its prompt.

- **Repeat the critical rules.** Don't assume the subagent knows the skill's
  constraints; restate the ones that matter for its task.
- **Inline all context.** Paste the specs, paths, templates, and standards it needs;
  don't reference "the plan above" it cannot see.
- **Name tools and why.** State which tools to use and which to avoid, with the
  reason — the reasoning lets it adapt (see `references/instruction-design.md` on reason-don't-bark).
- **Include quality standards.** The subagent won't inherit your bar for "done";
  spell it out.
- **Launch in parallel when possible** — use `run_in_background: true` to start an
  agent while you do setup work, instead of blocking on it.
