# Resync Procedure

## Purpose

This is a runbook for a Claude Code agent. When invoked on a device that has pulled this repo, it guides the agent through auditing the gap between the repo's `stow-managed/` configs and what currently exists on this machine's filesystem — then producing a plan to bring the machine in sync.

This process is **read-only with respect to the repo**. No git commits, no staging, no pushes. The target machine may not have push access and should be treated as read-only by default.

---

## Before You Start

Read the following files to orient yourself:
- `README.md` — repo structure, stow conventions, and tool stack
- `CLAUDE.md` — the `.local` file pattern, what must never be committed, and design goals

Key constraint to internalize: **generic config lives in `stow-managed/` (tracked), machine-specific config lives in `.local` variants (untracked).** This procedure must never move machine-specific or sensitive data into tracked files, and must never commit anything.

Confirm the repo path. This runbook assumes the repo lives at `~/Repos/dotfiles/`. If the clone is elsewhere, substitute the actual path throughout.

Create a working file at `/tmp/resync-audit.md` now. Write phase findings there as you go — inventory results, classifications, diffs, and the final plan. This survives context compaction and gives you a persistent reference throughout the session.

---

## Phase 1: Inventory

**Check guard directories first.** Some directories must exist as real directories (not symlinks) before stow runs, to allow tracked and local-only files to coexist inside them. Verify each of the following exists and is a real directory — not a symlink:
- `~/.claude/commands/`
- `~/.claude/agents/`

If either is missing, note it as a prerequisite for Phase 7. If either is a symlink, flag it — this means stow previously folded it and local-only files cannot be added safely until it is resolved.

Walk all files under `stow-managed/`, skipping git submodule directories (`powerlevel10k/`, `.tmux/plugins/`). For each file, determine its target path in `~` (strip the `stow-managed/` prefix).

Classify each file:
- **Symlinked** — `~/<file>` is already a symlink pointing into this repo. No action needed; mark as in sync.
- **Exists locally but not symlinked** — `~/<file>` is a real file. Needs comparison.
- **Missing locally** — `~/<file>` does not exist. Repo has something this machine doesn't yet.

Skip these directories entirely — they are not stow-managed and not in scope for this procedure:
- `aider/`
- `vscode/`
- `darktable/`
- `dockerfiles/`

**Fast path:** If every file is `MISSING_LOCALLY` (nothing exists locally at all — clean slate machine), skip Phases 2–4. Classify all files as `MISSING_LOCALLY`, proceed directly to Phase 5, and continue from there.

---

## Phase 2: Timeline Analysis

For each file that requires comparison (not already symlinked):

1. Run `git log --follow -1 --format="%ai %s" -- stow-managed/<path>` to get when the repo version was last changed and what that change was.
2. Check the mtime of the local `~/<file>` to see when it was last modified on this machine.
3. Note which side is newer and by how much.

Use this to calibrate how seriously to treat divergence:
- Local modified recently, repo untouched for a long time → likely intentional local customisation; treat carefully
- Repo updated recently, local stale → likely just needs the repo version applied
- Both changed recently → genuine conflict; needs careful review

---

## Phase 3: Diff and Semantic Analysis

For each file that exists in both places and is not yet symlinked, produce a diff. Then analyse it semantically — do not treat it as a simple line-count problem. Ask:

- Are the same aliases, functions, or keybindings present on both sides but in different locations within the file?
- Is the local version a superset of the repo version (has everything from repo plus additions)?
- Is the repo version a superset of the local version?
- Are there genuinely conflicting values — e.g. different colorscheme, different key bound to a different action, contradictory settings?
- Does the local version have config that clearly belongs on this machine only — machine-specific paths, work-specific aliases, environment variables with values that would be wrong or broken on another machine?

Flag any local content that looks sensitive or machine-specific:
- API keys, tokens, passwords (patterns like `export API_KEY=`, `token =`, `password =`, `secret`)
- Paths specific to this machine (e.g. `/home/<username>/`, company-internal paths)
- Work-specific aliases or env vars
- Anything that would be wrong or broken if applied to a different machine

---

## Phase 4: Sensitive Data Audit

Separately from the diff work, scan the contents of `stow-managed/` itself for anything that looks sensitive:
- API keys or tokens
- Passwords or credentials
- Private paths or company-internal identifiers
- Anything that would be a problem if this repo were made public or pulled to another machine

This is independent of the sync state. Sensitive data in `stow-managed/` is a problem in its own right — it means the repo may already be leaking secrets. Flag these prominently regardless of what the local machine has.

---

## Phase 5: Classify Each File

After analysis, assign each non-symlinked file one of these categories:

| Category | Meaning |
|----------|---------|
| `CLEAN_APPLY` | Repo version can be applied directly via stow; local has nothing new or different that matters |
| `LOCAL_MIGRATION` | Local has machine-specific or sensitive content that should be extracted into a `.local` file before stow is applied |
| `CONFLICT` | Both sides have changed the same setting in incompatible ways; needs explicit user decision |
| `LOCAL_ONLY_ADDITIONS` | Local file has meaningful content the repo doesn't have — assess whether it's machine-specific (keep local) or generic enough to upstream |
| `MISSING_LOCALLY` | File exists in repo but not at all on this machine; straightforward to apply |
| `SENSITIVE_IN_REPO` | Repo version contains content that should not be tracked; flag for remediation before proceeding |

---

## Phase 6: Produce the Plan

Present a structured plan. For each file, include the path, its category, a semantic summary of what differs, the proposed action, and any risks or things to double-check. Use this structure:

```
## Sync Plan

### Already in sync (symlinked)
- [list files]

### Missing locally — straightforward to apply
- [file]: [what it provides]

### Clean apply — repo version replaces local
- [file]: [what the repo version adds or changes vs local]

### Require local migration first
- [file]
  - Local content to extract: [describe what needs to move and why]
  - Proposed .local file: [e.g. ~/.zshrc.local]
  - Verify the main config sources it: [yes/needs adding]

### Conflicts requiring manual resolution
- [file]
  - Local has: [describe]
  - Repo has: [describe]
  - Nature of conflict: [incompatible values / structural difference / etc.]
  - Resolution: [ ] take repo  [ ] take local  [ ] merge  [ ] defer

### Local-only additions (assess intent)
- [file]: [describe the additions — machine-specific or potentially generic?]

### Sensitive data found in repo (remediation required)
- [file]: [what was found, line reference if possible]
```

**Stop here.** Present this plan to the user. Do not apply any changes until the user has reviewed, annotated, and explicitly approved. The user may adjust the plan, reclassify items, or ask questions before proceeding.

---

## Phase 7: Execution (After Approval Only)

Work through each approved item. Do not proceed on items the user has not approved or has asked to skip.

**Ensure guard directories exist before stowing.** If Phase 1 flagged any as missing, create them now:
```bash
mkdir -p ~/.claude/commands ~/.claude/agents
```
Do not proceed if any guard directory is a symlink — flag it for the user to resolve manually.

**For `MISSING_LOCALLY` and `CLEAN_APPLY` files:**
Run a stow dry run first: `stow -v --simulate -t ~ ~/Repos/dotfiles/stow-managed/`
Review the output, then apply: `stow -v -t ~ ~/Repos/dotfiles/stow-managed/`

Note: stow applies the entire package. If only specific files should be linked, handle them individually or confirm with the user before running a full stow.

**For `LOCAL_MIGRATION` files:**
1. Create the `.local` variant (e.g. `.zshrc` → `.zshrc.local`, `.gitconfig` → `.gitconfig.local`)
2. Extract the machine-specific or sensitive content from the local file into the `.local` file
3. Verify the main config file sources the `.local` file — most already do; check the file and add sourcing if missing
4. Only then apply stow for that file

**For `CONFLICT` files:**
Act only on items where the user has filled in a Resolution in the plan. The options are:

- **Take repo**: Back up the local file first (`cp ~/<file> ~/<file>.bak`), then stow. Verify the backup contains everything from the local version before proceeding.
- **Take local**: Do not stow this file. Leave the local version in place. If the content looks generic enough to share, flag it for potential upstreaming on a primary device.
- **Merge**: Produce a merged file — align shared content with the repo version, extract machine-specific parts into a `.local` file, then treat as `LOCAL_MIGRATION` and stow.
- **Defer**: Skip. Note the file in `/tmp/resync-audit.md` and leave both versions untouched.

Do not infer the resolution from context. If no resolution is recorded in the plan, treat it as deferred.

**For `LOCAL_ONLY_ADDITIONS` files:**
- If the content is machine-specific: move it to a `.local` file and apply stow
- If the content looks generic: flag it for potential upstreaming on a primary device — do not modify the repo from this machine

**For `SENSITIVE_IN_REPO` files:**
Do not apply these files. Flag them and leave remediation to the user. The issue needs to be fixed in the repo before syncing it further.

---

## After Applying

For each file that was stowed, verify the symlink is correct:
```bash
ls -la ~/<file>
```
It should point back into the repo under `~/Repos/dotfiles/stow-managed/`.

If stow reports a conflict (a non-symlink file is in the way), do not use `--adopt` without understanding exactly what it will overwrite. `--adopt` moves the local file into the repo — on a read-only device this is wrong. Instead, manually move or rename the conflicting local file, then re-run stow.
