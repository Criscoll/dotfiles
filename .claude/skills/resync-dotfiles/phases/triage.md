# Stage: Triage

Writes `$RESYNC_DIR/triage.md`. Reads `HOME_DIR`, `REPO_DIR`, and `RESYNC_DIR` from context (SKILL.md Step 0).

## Read state

```bash
cat "$RESYNC_DIR/state.md"
```

Confirm HOME_DIR and REPO_DIR are correct. Note the `Machine mode:` line — if `READ-ONLY`, divergences go into the ledger, not a commit.

## Check ledger for known-intentional items

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list
```

Items in the **Local-only** register are known-intentional drift — note them as such and do **not** re-present them as unexpected findings. Items in **Upstream-pending** with an overlay are expected inline edits — note them as "will reapply after stow."

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

## Reconcile pass (if a git pull occurred this session)

If a `git pull` was run during orientation or by the user before invoking the skill, run the reconcile pass now to auto-close any pending ledger entries that have landed upstream:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" reconcile
```

Report any entries that were auto-closed and remind the user to delete the absorbed overlay files if prompted.

## Classify missing tools

Extract the names of missing binaries, wrappers, PATH tools, and Docker images from the full audit output:

```bash
grep -iE 'FAIL|WARN' /tmp/resync-audit-full.txt | grep -iE 'missing|not in PATH|not installed|absent|backing binar'
```

From the matching lines, identify individual tool names (e.g. `nvim`, `rtk`, `rg`, `rclone`, `git-crypt`, `vd`, etc.). A single line may list several tools in parentheses — extract each one.

Check the ledger for existing decisions:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list-tools
```

For each tool name, check if a decision is already recorded:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" has-tool <name>
```

- `never` → suppress from triage output; do not surface again
- `pending` → note in triage "Deferred tool installs" section; do not ask again
- `install-now` → add to "Tools to Install" section for the plan stage
- `none` → decision needed; ask the user

**For undecided tools**, group them by category (wrappers, PATH tools, Docker images, credentials/config) and use `AskUserQuestion` to collect decisions — batch up to 4 questions per call, grouping related tools. Present options per group:

- **Never install on this machine** — record permanently in the ledger; never surface again
- **Install in this session** — add to the plan for execution now
- **Defer without recording** — no ledger entry; will ask again next session

Once the user responds, record `never` and `install-now` decisions:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" add-tool <name> never "<reason>"
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" add-tool <name> install-now "user requested install"
```

Do not record `defer` decisions — silence from the ledger means "ask again next session."

After execution of an `install-now` tool, update its decision to `pending` (so the ledger knows it was requested but not yet done if something interrupted) or remove it if successfully installed.

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

## Tool-decisions
### install-now (add to plan)
- rtk — requested this session
(or: none)

### pending (deferred; on record)
- pi — pending (will install manually)
(or: none)

## Fast-sync eligible: YES
```

## End of stage

Tell the user:

> Triage complete. Findings written to `.resync/triage.md`.
> Run `/clear` then re-invoke `/resync-dotfiles` to continue.
