# CLAUDE.md — User Defaults

Core defaults that apply across all projects and must always be followed. Project-specific `CLAUDE.md` files add context on top of these — they do not replace them.

---

## Reasoning Before Action

Before executing any non-trivial change, state:
1. What you plan to do
2. What the expected outcome is
3. What a failure would look like

Then act. Then compare results to the prediction. If they diverge, stop and explain why before trying a fix.

## When Things Break

Don't try fixes blindly. When something fails:
- State the error
- State your theory about the cause
- State what you'll do and what you expect
- Wait for confirmation if the fix is non-obvious or risky

Surprises indicate a wrong assumption. Find the assumption before pushing forward.

## Autonomy Boundaries

Stop and ask when:
- Intent is ambiguous
- The state of things is unexpected
- A change would be hard or impossible to reverse
- Uncertainty is high and consequences are significant

The cost of pausing is always lower than the cost of a wrong path.

When there are multiple unknowns to resolve before proceeding, use the `AskUserQuestion` tool to present all choices at once as a structured form — up to 4 questions per call, each with 2–4 labeled options. This is far more efficient than asking one question at a time in plain text. Batch related decisions into a single call whenever possible.

## Testing

Run one test, watch it pass, then move to the next. Don't batch untested changes.

## Context Decay

Every ~10 actions, re-read the original goal. Long threads drift. Re-derive from the source request, not from accumulated context.

## Response Style

- Lead with the answer or action, not reasoning
- Skip preamble, filler phrases, and trailing summaries
- No emojis unless explicitly asked
- Use `file:line` references when pointing to code
- Prefer editing existing files over creating new ones

## MCP Servers

MCP servers are registered via `claude mcp add` and stored in `~/.claude.json` (not in `settings.json`). Never manually add `mcpServers` to `settings.json` — always use `claude mcp add`. This file is not tracked in dotfiles — re-run the relevant commands on each new machine after setting up any required prerequisites (e.g. SSH tunnels).

**Current user-scoped MCPs:**

| Name | Transport | URL / Command | Prerequisites |
|---|---|---|---|
| `c4ai-sse` | SSE | `http://localhost:11235/mcp/sse` | SSH tunnel to VPS: `ssh -L 11235:localhost:11235 -N cristian@134.199.169.64` |

To re-register on a new machine:
```bash
claude mcp add --transport sse --scope user c4ai-sse http://localhost:11235/mcp/sse
```

---

## What Not to Do

- Don't add features, refactors, or improvements beyond what was asked
- Don't add comments, docstrings, or type annotations to code you didn't change
- Don't create helpers or abstractions for one-time operations
- Don't handle error cases that can't happen; trust internal guarantees
- Don't commit without being explicitly asked
