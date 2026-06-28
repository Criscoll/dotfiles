# Phase 0: Orientation

Verify `/tmp/resync-audit.md` exists and read `HOME_DIR` and `REPO_DIR` from its `## Confirmed Paths` section. If the file is absent (phase entered standalone, bypassing SKILL.md), re-derive and create it now:

```bash
grep -A4 "## Confirmed Paths" /tmp/resync-audit.md 2>/dev/null || echo "File not found — re-derive paths"
```

If re-deriving:

```bash
realpath ~
for p in ~/Repos/dotfiles ~/dotfiles ~/src/dotfiles ~/projects/dotfiles ~/.dotfiles; do
  [ -d "$p/stow-managed" ] && echo "Found: $(realpath $p)"
done
```

Then create the working file with the confirmed values before continuing:

```bash
{ echo "# Resync Audit"
  echo "Started: $(date)"
  echo "Machine: $(hostname)"
  echo ""
  echo "## Confirmed Paths"
  echo "HOME_DIR=$HOME_DIR"
  echo "REPO_DIR=$REPO_DIR"
  echo ""
} > /tmp/resync-audit.md
```

---

## Orient yourself

Read these two files (substituting the confirmed repo path):
- `<REPO_DIR>/README.md` — repo structure, stow conventions, tool stack
- `<REPO_DIR>/CLAUDE.md` — the .local file pattern, guard directories, what must never be committed

Internalize these constraints:
- **Generic config** lives in `stow-managed/` (tracked in repo)
- **Machine-specific config** lives in `.local` variants (untracked, never committed)
- This process is **read-only with respect to the repo**: no git commits, no staging, no pushes
- The target machine may not have push access — treat it as read-only by default

---

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 0 done
```

Then fetch and execute the phase it returns.
