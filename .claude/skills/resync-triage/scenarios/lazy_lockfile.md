# Scenario: lazy-lock.json shows as modified or conflicting

`stow-managed/.config/nvim/lazy-lock.json` is a **committed snapshot** — it represents a
known-good set of plugin versions, not live runtime state. Lazy is configured to write its
runtime lockfile to `~/.local/share/nvim/lazy-lock.json` (stdpath "data"), outside the stow
tree. The repo file is never written to by lazy at runtime.

If it appears dirty or conflicting, the machine has an older stow setup where lazy was still
writing to `~/.config/nvim/lazy-lock.json` (the symlink), or the file was edited directly.

## Confirm

```bash
# Is the repo file actually a symlink?
ls -la $HOME_DIR/.config/nvim/lazy-lock.json

# What does lazy think its lockfile path is?
grep -n "lockfile" $REPO_DIR/stow-managed/.config/nvim/lua/lazy-plugin-manager.lua
```

If the `lockfile` option is absent or not pointing to stdpath("data"), the stow setup
predates this convention. Apply the fix before resolving the conflict.

## Fix: point lazy to the runtime path

In `stow-managed/.config/nvim/lua/lazy-plugin-manager.lua`, the setup call must be:

```lua
require('lazy').setup('plugins', {
  lockfile = vim.fn.stdpath("data") .. "/lazy-lock.json",
})
```

## Resolve the conflict

The repo version is the intentional snapshot. Discard the local changes:

```bash
git -C $REPO_DIR checkout -- stow-managed/.config/nvim/lazy-lock.json
```

This is safe — the local runtime state lives at `~/.local/share/nvim/lazy-lock.json` and is
unaffected.

## Bootstrap the runtime lockfile (new machine or first run after the fix)

Copy the snapshot to the runtime path so lazy pins to the known-good versions on first launch:

```bash
cp $HOME_DIR/.config/nvim/lazy-lock.json $HOME_DIR/.local/share/nvim/lazy-lock.json
```

If `~/.local/share/nvim/` does not exist yet, create it first:

```bash
mkdir -p $HOME_DIR/.local/share/nvim
cp $HOME_DIR/.config/nvim/lazy-lock.json $HOME_DIR/.local/share/nvim/lazy-lock.json
```

## Updating the snapshot (primary devices only)

When you intentionally want to bump the snapshot after running `:Lazy update`:

```bash
cp $HOME_DIR/.local/share/nvim/lazy-lock.json \
   $REPO_DIR/stow-managed/.config/nvim/lazy-lock.json
# Then commit from a primary device with a message like:
# "chore: bump lazy.nvim lockfile snapshot"
```

Never commit the lockfile from a read-only machine.
