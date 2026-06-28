# Phase 1: Inventory

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md`.

## Guard directories

`dotfiles-audit` already checked guard directories in phase_0. Reference the audit output rather than re-running these checks. If any guard dir FAILs were flagged there, note them here as prerequisites for Phase 7.

---

## Check per-machine exclusions

Check whether this machine has a `.stow-local-ignore` file, which controls which paths stow will skip when linking:

```bash
if [ -f "$REPO_DIR/stow-managed/.stow-local-ignore" ]; then
  echo "Found .stow-local-ignore:"
  cat "$REPO_DIR/stow-managed/.stow-local-ignore"
else
  echo "No .stow-local-ignore found."
fi
```

**Ask the user:** Are there tools or config sections that are not relevant for this machine (e.g. mail tools on a Mac, work-specific integrations on a personal machine)? If so, they can be excluded by creating `stow-managed/.stow-local-ignore` with one regex pattern per line. This file is gitignored — each machine keeps its own.

Example content:
```
^snap/neomutt
^\.mbsyncrc
^\.config/msmtp
```

If the user wants to add exclusions, help them create or update the file before continuing. The classification in the next step will then reflect only what stow would actually link.

---

## Check machine-specific Claude settings

Check whether this machine has a `settings.local.json` for Claude Code:

```bash
if [ -f "$HOME_DIR/.claude/settings.local.json" ]; then
  echo "Found settings.local.json:"
  cat "$HOME_DIR/.claude/settings.local.json"
else
  echo "No settings.local.json found."
fi
```

`settings.local.json` overrides `settings.json` on a per-machine basis. Common uses:
- `statusLine` — custom status bar command (only relevant on machines with the script)
- Machine-specific permission rules

If the user has a statusline script at `$HOME/.claude/statusline-command.sh`, suggest creating or updating `settings.local.json`:
```json
{
  "statusLine": {
    "type": "command",
    "command": "bash $HOME/.claude/statusline-command.sh"
  }
}
```

Note that `$HOME` in the command string is expanded by the shell at runtime.

---

## Generate classification temp files

`dotfiles-diff` already produced the stow inventory in `/tmp/resync-diff.txt`. Parse it to generate the temp files that phases 2 and 3 consume:

```bash
python3 -c "
import re
with open('/tmp/resync-diff.txt') as f:
    for line in f:
        m = re.match(r'\s+BLOCKED\s+~/(\S+)', line)
        if m: print(m.group(1))
" > /tmp/resync-exists-locally.txt

python3 -c "
import re
with open('/tmp/resync-diff.txt') as f:
    for line in f:
        m = re.match(r'\s+MISSING\s+~/(\S+)', line)
        if m: print(m.group(1))
" > /tmp/resync-missing-locally.txt
```

Then detect COLLAPSIBLE_DIR entries — `dotfiles-diff` does not classify these, so run `inventory.sh` for this purpose only:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/inventory.sh $HOME_DIR $REPO_DIR 2>/dev/null | grep "^COLLAPSIBLE_DIR" > /tmp/resync-collapsible-dirs.txt
cat /tmp/resync-collapsible-dirs.txt
```

Write a summary of counts to `/tmp/resync-audit.md`. List `EXISTS_LOCALLY` (BLOCKED), `MISSING_LOCALLY`, and `COLLAPSIBLE_DIR` entries individually; FOREIGN entries individually for user confirmation; others by count.

---

## Fast path

If there are zero `EXISTS_LOCALLY` files (no genuinely local files to analyse), skip phases 2–4 and go directly to classification.

---

## Next

```bash
# No EXISTS_LOCALLY files — skip to classification:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 1 clean_slate

# Any EXISTS_LOCALLY files — need analysis:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 1 has_local_files
```

Then fetch and execute the phase it returns.
