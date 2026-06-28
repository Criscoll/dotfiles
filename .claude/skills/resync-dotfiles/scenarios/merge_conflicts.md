# Scenario: Merge conflicts after `git pull`

Conflicts in dotfiles repos almost always mean a tracked config file was edited directly on this machine instead of going through a `.local` file. The machine diverged from the repo.

## Confirm and list

```bash
git -C $REPO_DIR diff --name-only --diff-filter=U
```

For each conflicting file, read the conflict markers:

```bash
grep -n "<<<<<<\|======\|>>>>>>" $REPO_DIR/stow-managed/<file>
```

## Classify each conflict

Ask for each conflicting section:

- **Machine-specific on one side?** (company paths, local env vars, work aliases, absolute paths that only make sense here) → extract that content into a `.local` file, take the repo version for the shared portion.
- **Functionally identical?** (upstream added the same config the local machine already had — same alias, same option, same key binding, just landed in the repo later) → always take upstream. The repo version is now canonical; keeping the local variant would cause drift without any benefit.
- **Both sides are generic?** → the local edit may be worth upstreaming. Take the better version. On a READ-ONLY machine, record in the ledger as upstream-pending:
  ```bash
  bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" \
    add-upstream "stow-managed/<file>" "<what was added>"
  ```
  If the file cannot use a `.local` import, also capture an overlay: `add-overlay <file>`.
  On a READ-WRITE machine, note as a candidate to commit from this machine.
- **Incompatible values?** (different colorscheme, key bound to a different action) → present to the user. Do not resolve without an explicit choice. If the user chooses to keep the local value:
  - Machine-specific → `add-local <file> "<reason>"`
  - Generic but can't go upstream from here → `add-upstream <file> "<description>"` (+ overlay if needed)

## Resolution

For machine-specific content that needs to move to `.local`:

```bash
# Create the .local file if it doesn't exist
touch $HOME_DIR/.zshrc.local   # adjust filename to match the config

# Confirm the main file sources its .local variant
grep -n "local" $REPO_DIR/stow-managed/.zshrc
# If not present, add: [[ -f ~/.zshrc.local ]] && source ~/.zshrc.local
```

Move the machine-specific lines to the `.local` file, edit out the conflict markers, then mark resolved:

```bash
git -C $REPO_DIR add stow-managed/<file>
git -C $REPO_DIR status
```

Never use `git checkout -- <file>` to discard the local side without reading it first. Local edits represent real state on this machine.

## After resolving

```bash
git -C $REPO_DIR status   # should be clean
# Then check whether stow needs to run — if the file was already symlinked, no stow step needed.
ls -la $HOME_DIR/<file>
```

If the local file is not yet a symlink into the repo, check for a stow collision next — load `scenarios/stow_collision.md`.
