# Scenario: Machine-specific content in tracked config

A tracked config file (`stow-managed/.zshrc`, `stow-managed/.gitconfig`, etc.) contains content that is specific to this machine — API keys, company-internal paths, work aliases, or absolute paths that would break on another machine.

This is a problem in its own right: the content is in a repo that may be cloned to other machines.

## Detect

Scan for common patterns:
```bash
grep -rn -E '(API_KEY|TOKEN|PASSWORD|SECRET|PRIVATE)' $REPO_DIR/stow-managed/ \
  --include="*.zshrc" --include="*.gitconfig" --include="*.env" 2>/dev/null

# Machine-specific absolute paths
grep -rn -E '(=/home/|=/Users/|/company-internal/)' $REPO_DIR/stow-managed/ 2>/dev/null

# Work-specific aliases (adjust pattern to what's relevant)
grep -rn -E '(alias work|alias vpn|alias corp)' $REPO_DIR/stow-managed/ 2>/dev/null
```

## Fix: extract to a `.local` file

The `.local` file convention: machine-specific config lives in `~/.zshrc.local`, `~/.gitconfig.local`, etc., which are sourced by the main config but never tracked in the repo.

**1. Confirm the main file sources its `.local` variant:**
```bash
grep -n "local" $REPO_DIR/stow-managed/.zshrc
```

Expected pattern in `.zshrc`:
```bash
[[ -f ~/.zshrc.local ]] && source ~/.zshrc.local
```

If it's missing, add it before proceeding.

**2. Create the `.local` file on this machine:**
```bash
# The .local file lives in HOME_DIR, not in the repo
touch $HOME_DIR/.zshrc.local
```

**3. Move the machine-specific content:**
- Copy the lines into `$HOME_DIR/.zshrc.local`
- Remove them from `$REPO_DIR/stow-managed/.zshrc`
- Verify the main file still works (source it: `source ~/.zshrc`)

**4. Commit the cleaned file from a primary device:**

This is a repo change. If this machine has push access, commit and push. If it's read-only, note the change as a candidate to apply from a primary device — do not commit here.

```bash
git -C $REPO_DIR diff stow-managed/.zshrc   # review before staging
```

## `.gitconfig.local` pattern

Git has built-in support:
```ini
# In .gitconfig (tracked):
[include]
    path = ~/.gitconfig.local
```

Machine-specific `[user]` blocks, work email, signing keys, etc. go in `~/.gitconfig.local`.

## After extracting

Run stow simulation to confirm the cleaned file would link cleanly:
```bash
cd $REPO_DIR && stow -v --simulate -t $HOME_DIR stow-managed
```
