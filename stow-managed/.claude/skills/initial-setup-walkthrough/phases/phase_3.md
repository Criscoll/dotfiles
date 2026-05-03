# Phase 3: Guard Directories and Stow Bootstrap

Guard directories must exist as real directories before stow runs. Without them, stow folds the entire directory into a single symlink — leaving no room for machine-specific local files to sit alongside tracked ones.

The `settings.json` bootstrap conflict: a fresh Claude Code install creates `~/.claude/settings.json` as a plain file. Stow cannot replace a regular file with a symlink and will abort.

## Create guard directories
```bash
mkdir -p ~/.claude/commands ~/.claude/agents ~/.claude/skills
```

## Resolve the settings.json conflict
```bash
if [ -f ~/.claude/settings.json ] && [ ! -L ~/.claude/settings.json ]; then
  mv ~/.claude/settings.json ~/.claude/settings.json.bak
  echo "Backed up plain settings.json to settings.json.bak"
else
  echo "No conflict — settings.json is absent or already a symlink"
fi
```

## Confirm
```bash
ls -la ~/.claude/commands ~/.claude/agents ~/.claude/skills
ls -la ~/.claude/settings.json 2>/dev/null || echo "settings.json absent (expected at this point)"
```

## Route
```bash
python3 ${CLAUDE_SKILL_DIR}/orchestrate.py --route 3 done
```
