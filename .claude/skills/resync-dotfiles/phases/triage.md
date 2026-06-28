# Stage: Triage

Writes `$RESYNC_DIR/triage.md`. Reads `HOME_DIR`, `REPO_DIR`, and `RESYNC_DIR` from context (SKILL.md Step 0).

## Read state

```bash
cat "$RESYNC_DIR/state.md"
```

Confirm HOME_DIR and REPO_DIR are correct.

## Run full audit tools (within-stage /tmp/ scratch)

```bash
dotfiles-audit --no-color > /tmp/resync-audit-full.txt 2>&1
dotfiles-diff --no-color > /tmp/resync-diff-full.txt 2>&1
```

Surface summary into context:

```bash
dotfiles-audit --no-color --fails
dotfiles-diff --no-color --summary
git -C "$REPO_DIR" diff --name-only --diff-filter=U 2>/dev/null
```

If a scenario needs the full per-item listing:

```bash
cat /tmp/resync-audit-full.txt
cat /tmp/resync-diff-full.txt
```

## Check per-machine exclusions

```bash
if [ -f "$REPO_DIR/stow-managed/.stow-local-ignore" ]; then
  echo "Found .stow-local-ignore:"
  cat "$REPO_DIR/stow-managed/.stow-local-ignore"
else
  echo "No .stow-local-ignore found."
fi
```

Ask the user if there are tools or config sections not relevant for this machine (e.g. mail tools on a Mac, work-specific integrations on a personal machine). If so, help create or update `stow-managed/.stow-local-ignore` now — it affects what the inventory counts as MISSING vs. excluded.

## Check machine-specific Claude settings

```bash
if [ -f "$HOME_DIR/.claude/settings.local.json" ]; then
  echo "settings.local.json exists:"
  cat "$HOME_DIR/.claude/settings.local.json"
else
  echo "No settings.local.json"
fi
```

Note any discrepancy for the plan stage.

## Generate inventory temp files

Parse `dotfiles-diff` output:

```bash
python3 -c "
import re
with open('/tmp/resync-diff-full.txt') as f:
    for line in f:
        m = re.match(r'\s+BLOCKED\s+~/(\S+)', line)
        if m: print(m.group(1))
" > /tmp/resync-exists-locally.txt

python3 -c "
import re
with open('/tmp/resync-diff-full.txt') as f:
    for line in f:
        m = re.match(r'\s+MISSING\s+~/(\S+)', line)
        if m: print(m.group(1))
" > /tmp/resync-missing-locally.txt
```

Check collapsible directories:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/collapsible_dirs.sh" "$HOME_DIR" "$REPO_DIR" 2>/dev/null
cat /tmp/resync-collapsible-dirs.txt
```

## Timeline analysis (EXISTS_LOCALLY files only)

Skip this section if `/tmp/resync-exists-locally.txt` is empty.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/timeline.sh" "$HOME_DIR" "$REPO_DIR"
```

The script reads `/tmp/resync-exists-locally.txt` and outputs a TSV: `REL_PATH | REPO_DATE | LOCAL_DATE | NEWER`.

| NEWER | Interpretation |
|---|---|
| `SAME` | Timestamps within 60s — local was likely source of the commit |
| `REPO` | Repo is newer — machine is behind |
| `LOCAL` | Local is newer — possible intentional local change |
| `UNKNOWN` | No git history or stat failed — inspect manually |

## Diff and semantic analysis (EXISTS_LOCALLY files only)

Skip this section if `/tmp/resync-exists-locally.txt` is empty.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/diff_check.sh" "$HOME_DIR" "$REPO_DIR"
```

The script outputs:
1. Diff results — `IDENTICAL` or `DIFFERS` per file, with actual diff for divergent files
2. Sensitive scan — grep results for credential patterns across `stow-managed/`

For each `DIFFERS` file, assess semantically:
- Is local a superset of repo? Or repo a superset of local?
- Are there genuinely conflicting values (different setting on each side)?
- Does local have machine-specific paths, tokens, or work-specific content?

## Sensitive data review

Review the sensitive scan output from `diff_check.sh`:
- `POSSIBLE SECRETS FOUND` — is it a real credential or just a variable name / comment?
- Company-internal paths hard-coded in config?
- Anything problematic if the repo were public or cloned to another machine?

## Route to scenarios if needed

If the audit surfaces FAILs or anomalies, consult the **Scenario routing** table in SKILL.md and load the relevant scenario(s) now. Handle them before writing `triage.md`.

## Determine fast-sync eligibility

`Fast-sync eligible: YES` only if **all** of the following are true:
- `EXISTS_LOCALLY` count = 0
- No merge conflicts detected
- No `POSSIBLE SECRETS FOUND` in the repo scan
- No FAILs in `dotfiles-audit --fails`

Otherwise: `Fast-sync eligible: NO`.

## Write triage.md

Use the Write tool to create `$RESYNC_DIR/triage.md`. Write a compact, distilled summary — not raw tool output. The plan stage reads only this file, so it must be self-contained.

```markdown
# Resync Triage
> Stage: triage — complete

## Missing Locally (straightforward apply)
- file1
- file2
(or: none)

## Exists Locally
| File | Status | Newer | Action-hint |
|---|---|---|---|
| .gitconfig | DIFFERS | LOCAL | check for machine-specific |
| .vimrc | IDENTICAL | SAME | clean apply |
(or: (none))

## Collapsible Dirs
- .config/nvim — all files resolve to repo
(or: none)

## Sensitive Flags
- none
(or: list findings)

## Stow-local-ignore exclusions
- none
(or: list active exclusions)

## Fast-sync eligible: YES
```

## End of stage

Tell the user:

> Triage complete. Findings written to `.resync/triage.md`.
> Run `/clear` then re-invoke `/resync-dotfiles` to continue.
