# Phase 0: Orientation

## Step 1: Resolve paths

Determine the real paths for this machine before doing anything else.

**Home directory:**
```bash
realpath ~
```

**Dotfiles repo — check common locations:**
```bash
for p in ~/Repos/dotfiles ~/dotfiles ~/src/dotfiles ~/projects/dotfiles ~/.dotfiles; do
  [ -d "$p/stow-managed" ] && echo "Found: $(realpath $p)"
done
```

If the repo is not found at any of those locations, search more broadly:
```bash
find ~ -maxdepth 5 -name "stow-managed" -type d 2>/dev/null | head -5
```

**Confirm with the user before proceeding.** Present what you found:

```
Home directory:  [resolved path]
Dotfiles repo:   [resolved path, or "not found"]
```

Ask the user to confirm these are correct, or to provide the correct repo path if it wasn't found. Do not proceed until both paths are confirmed.

---

## Step 2: Orient yourself

Read these two files (substituting the confirmed repo path):
- `<REPO_DIR>/README.md` — repo structure, stow conventions, tool stack
- `<REPO_DIR>/CLAUDE.md` — the .local file pattern, guard directories, what must never be committed

Internalize these constraints:
- **Generic config** lives in `stow-managed/` (tracked in repo)
- **Machine-specific config** lives in `.local` variants (untracked, never committed)
- This process is **read-only with respect to the repo**: no git commits, no staging, no pushes
- The target machine may not have push access — treat it as read-only by default

---

## Step 3: Create the working file

Create `/tmp/resync-audit.md` with the confirmed paths at the top:

```
# Resync Audit
Started: [current timestamp]
Machine: [output of `hostname`]

## Confirmed Paths
HOME_DIR=[confirmed home directory]
REPO_DIR=[confirmed repo path]
```

This file persists across context compaction. Append all findings to it as you work through each phase. **Every subsequent phase that runs shell commands must read HOME_DIR and REPO_DIR from this file.**

---

## Step 4: Version Check

The README contains a **Tool Stack** table with the versions this config was last tested against. Check what is installed locally and compare.

For each tool in the table, run the version command below and note the output:

| Tool | Version command |
|------|----------------|
| zsh | `zsh --version` |
| alacritty | `alacritty --version 2>/dev/null` |
| tmux | `tmux -V 2>/dev/null` |
| neovim | `nvim --version 2>/dev/null \| head -1` |
| helix | `hx --version 2>/dev/null` |
| delta | `delta --version 2>/dev/null` |
| fzf | `fzf --version 2>/dev/null` |
| ripgrep | `rg --version 2>/dev/null \| head -1` |
| rclone | `rclone --version 2>/dev/null \| head -1` |
| mbsync | `mbsync --version 2>/dev/null` |
| msmtp | `msmtp --version 2>/dev/null \| head -1` |

For each tool, classify the result as:
- `CURRENT` — installed version matches or is newer than the README version
- `OUTDATED` — installed version is older than the README version
- `NOT_INSTALLED` — command not found or produced no output

Skip classification for tools where the README version cell shows `—`.

Append a version status table to `/tmp/resync-audit.md`:

```
## Tool Version Check

| Tool | README version | Installed version | Status |
|------|----------------|-------------------|--------|
| zsh | ... | ... | CURRENT / OUTDATED / NOT_INSTALLED |
...
```

**Present this table to the user.** For any `OUTDATED` tool, note that the installed version may not be compatible with the current config. For any `NOT_INSTALLED` tool, note that the tool is absent from this machine and its associated config will have nothing to target.

---

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 0 done
```

Then fetch and execute the phase it returns.
