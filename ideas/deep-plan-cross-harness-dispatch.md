# Cross-Harness Dispatch for Batch-Mode Orchestration

## Problem

Batch-mode deep-plan (`references/model-tiers.md`) assigns every dispatch step a tier, and
each harness has its own concrete recipe for running a step at that tier: pi has the
`subagent` tool with a per-task `model`/`provider` override (added alongside this idea doc);
Claude Code has the `Agent` tool with a `model` parameter. But Claude Code's `Agent` tool only
accepts Anthropic model aliases (`opus`, `sonnet`, `haiku`) — it has no mechanism to shell out
to a different provider or CLI. So a Claude Code orchestrator cannot itself dispatch a step to
pi running DeepSeek or Kimi, even though the tier table names those as the pi-side fast/standard
tier. Today the orchestrator is implicitly assumed to dispatch within its own harness only;
nothing lets it reach across.

## Findings

- **pi's dispatch pattern** (`subagent.ts:430-436`, `getPiInvocation` at `subagent.ts:378-392`):
  spawn a child `pi` process with
  `pi --mode json -p --no-session --provider <p> --model <m> --tools <allowlist> --append-system-prompt <tmpfile> "Task: <task>"`,
  reading newline-delimited JSON events from stdout (`message_end`, `tool_result_end`) and
  parsing `usage`/`cost`/`model` off each `message_end` event's `message.usage` and
  `message.model` fields. This is a plain subprocess call — nothing about it is pi-specific
  except the flags, so any harness capable of running `bash` could shell out to it the same way.
- **Cost/usage parsing**: the JSON event stream carries `usage.cost.total`, `usage.input`,
  `usage.output`, `usage.cacheRead`/`cacheWrite` per `message_end` — the exact fields
  `subagent.ts`'s `formatUsageStats` aggregates. A cross-harness dispatcher would sum these the
  same way regardless of which harness spawned the process.
- **rtk/hook considerations**: no longer applicable — rtk has been uninstalled from both
  harnesses (2026-09-15).
- **Permissions**: Claude Code's Bash tool would prompt for approval on a `pi --mode json -p`
  invocation unless pre-approved in `settings.json`/`settings.local.json` — an orchestrator
  running "hands-off" per the batch-mode design would stall on that prompt unless the command
  pattern is allowlisted ahead of time (see `update-config` skill).

## Next Steps

- Add a **shell-command dispatch recipe column** to the tier table in
  `references/model-tiers.md` — e.g. a `Shell recipe (cross-harness)` column giving the literal
  `pi --mode json -p --no-session --provider <p> --model <m> --tools <t> "Task: ..."` invocation,
  so any harness's orchestrator (not just pi's own `subagent` tool) can dispatch a step to a pi
  child process and parse its JSON stream directly.
- Work out how the orchestrator parses that JSON stream generically — likely a small shared
  parsing recipe (read `message_end`/`tool_result_end` events, extract final assistant text and
  `usage`) documented once rather than reimplemented per harness.
- Decide whether Claude Code orchestration should pre-approve the `pi --mode json -p ...`
  command pattern via `settings.json` so a batch run doesn't stall on a permission prompt mid-way
  through unattended execution — or whether that's an explicit non-goal (hands-off should still
  mean "a human is watching for permission prompts," not "root-equivalent shell access").
- Prototype one cross-harness dispatch (Claude Code orchestrator → pi child running DeepSeek) end
  to end before generalizing the recipe to other harnesses (pi orchestrator → Claude Code CLI,
  etc.), since the untested piece is specifically whether Claude Code's Bash sandboxing and
  approval flow tolerate a long-running unattended subprocess loop.

## Out of Scope (for now)

- Parallel item execution or worktrees — orthogonal to cross-harness dispatch.
- A generalized "any harness can drive any harness" abstraction — start from the one concrete
  pain point (Claude Code needing non-Anthropic models) rather than designing for hypothetical
  future harnesses.
