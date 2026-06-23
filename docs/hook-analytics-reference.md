# Hook Analytics

A unified logging and analytics system that tracks every invocation of every hook across both Claude Code (shell hooks in `~/.claude/hooks/`) and pi (TypeScript extensions in `~/.pi/agent/extensions/`).

## Log Location

- **`~/.local/share/hook-analytics/hooks.jsonl`** — machine-local, not tracked in the repo. Created on first write by either logger.

## Resilience Guarantees

Logging is best-effort and **never affects** the hook's safety function:
- **Claude Code hooks**: The resilient source pattern (file-existence guard + no-op fallback) ensures the hook runs even if `hook-logger.sh` is absent
- **Pi extensions**: `withHookLogging` self-tests writability at module load; if logging is impossible, it returns the handler unchanged (transparent pass-through)

## How to Instrument a New Hook

**Claude Code hook (bash):**
1. Copy the resilient source pattern from any existing instrumented hook (the `HOOK_LOGGER` + `if ! declare -f` block)
2. Call `hook_log_start "<hook-name>" "<event>"` after sourcing the logger
3. Call `hook_log_end "<outcome>" "<reason>" <exit_code>` before each exit point inside deny/ask/notify functions, and at the final `exit 0`

**Pi extension (TypeScript):**
1. Import: `import { withHookLogging } from "./hook-logger";`
2. Wrap: `pi.on("<event>", withHookLogging("<name>", "<event>", async (event, ctx) => { ... }))`
3. No guard needed — `withHookLogging` self-degrades to a pass-through when logging is impossible

## How to View Analytics

```
hook-analytics                    Summary dashboard
hook-analytics --history          Last 20 invocations
hook-analytics --failures         Error entries only
hook-analytics --hook <name>      Detailed log for one hook
hook-analytics --daily            Daily breakdown table
hook-analytics --weekly           Weekly breakdown table
hook-analytics --monthly          Monthly breakdown table
hook-analytics --all              Daily + weekly + monthly
hook-analytics --graph            ASCII bar chart of daily invocations
hook-analytics --json             Output filtered records as JSON
hook-analytics --since <date>     Filter to on-or-after date (YYYY-MM-DD)
hook-analytics --harness <name>   Filter to claude-code or pi
hook-analytics --limit <N>        Cap result count (for --history, --hook)
```

## Testing Hooks End-to-End

**Problem:** PreToolUse hooks that pattern-match against the command string will fire on their *own test scaffolding* if the blocked pattern appears anywhere in the outer bash command — including inside quoted string literals or JSON arguments.

For example, this silently fails because `grep -r` appears in the `printf` argument:

```bash
# The outer hook sees the full string and matches "grep -r" inside the JSON literal
printf '%s' '{"tool_input":{"command":"grep -r foo ."}}' | bash .../catch-stupid-commands.sh
```

The hook denies the outer command, the subprocess never runs, and the `<error>` field in the tool result shows the deny reason — which looks like the hook ran correctly but is actually the hook blocking the test itself.

**Fix:** Write the test input to a file first, constructing the blocked pattern programmatically so it never appears literally in the outer command:

```python
# Python concatenation: pattern doesn't exist as a literal string the hook can match
cmd = 'grep' + ' -r foo .'
payload = json.dumps({'tool_input': {'command': cmd}})
with open('/tmp/test_input.json', 'w') as f:
    f.write(payload)
```

Then feed the file as stdin:

```bash
bash .../catch-stupid-commands.sh < /tmp/test_input.json
```

**Implication for test suites:** Call the shared detection script directly (e.g. `check-inefficient-command.sh`) rather than testing the hook wrapper end-to-end. The wrapper's only job is to call the script and format the output — the script is where all testable logic lives. See `tests/hooks/test-check-inefficient-command.sh` as the pattern.

## JSONL Schema

Each line is a JSON object with these fields:
- `ts` — ISO 8601 UTC timestamp
- `harness` — `"claude-code"` or `"pi"`
- `hook` — hook name (e.g. `"catch-dangerous-commands"`)
- `event` — hook event type (e.g. `"PreToolUse"`, `"tool_call"`)
- `outcome` — `"passed"` | `"asked"` | `"denied"` | `"blocked"` | `"notified"` | `"handled"` | `"error"`
- `reason` — human-readable reason string
- `duration_ms` — elapsed wall-clock milliseconds
- `exit_code` — numeric exit code
