# Scenario: `settings.local.json` missing or stale

`~/.claude/settings.local.json` provides per-machine overrides for Claude Code settings. It is never committed. After a fresh stow on a new machine, `settings.json` is linked from the repo but `settings.local.json` does not exist — machine-specific behavior (e.g. the status bar) is silently absent.

## Check current state

```bash
echo "=== settings.json (stowed from repo) ==="
cat $HOME_DIR/.claude/settings.json 2>/dev/null || echo "missing"

echo "=== settings.local.json (machine-local override) ==="
cat $HOME_DIR/.claude/settings.local.json 2>/dev/null || echo "missing"
```

Also confirm `settings.json` is actually a symlink into the repo:
```bash
ls -la $HOME_DIR/.claude/settings.json
```

## Common overrides to check for

**Status bar** — only relevant if the machine has the statusline script:
```bash
ls -la $HOME_DIR/.claude/statusline-command.sh 2>/dev/null || echo "no statusline script"
```

If the script exists and `settings.local.json` is missing or lacks a `statusLine` entry, create or update it:
```json
{
  "statusLine": {
    "type": "command",
    "command": "bash $HOME/.claude/statusline-command.sh"
  }
}
```

Note: `$HOME` in the command string is expanded by the shell at runtime — this is intentional.

**Machine-specific permission rules** — if this machine has different permission needs than the global defaults in `settings.json`, those belong in `settings.local.json` as well.

## Write or update

```bash
# Write to the machine-local path, not the stow-managed path
$EDITOR $HOME_DIR/.claude/settings.local.json
```

`settings.local.json` overrides `settings.json` at runtime — only include keys that need to differ from the shared defaults.

## Verify

Restart Claude Code (or open a new session) and confirm the overrides are active.
