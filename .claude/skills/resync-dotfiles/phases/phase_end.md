# Resync Complete

Read `/tmp/resync-audit.md` and produce a brief summary:

- How many files were processed
- How many are now symlinked (including via directory symlinks)
- What was migrated to `.local` files (and which files)
- How conflicts were resolved
- What was deferred (and why)
- Any sensitive data flags that still need attention in the repo

If anything requires follow-up on a primary device (e.g. upstreaming local-only generic additions), list those files explicitly.

Confirm guard directories exist as real directories (not symlinks):

```bash
for d in commands agents skills; do
  path="$HOME_DIR/.claude/$d"
  if [ -L "$path" ]; then
    echo "SYMLINK (problem): $path"
  elif [ -d "$path" ]; then
    echo "OK: $path"
  else
    echo "MISSING (problem): $path"
  fi
done
```

The working file `/tmp/resync-audit.md` remains for reference. Clean it up when no longer needed:

```bash
rm /tmp/resync-audit.md /tmp/resync-exists-locally.txt /tmp/resync-missing-locally.txt /tmp/resync-collapsible-dirs.txt 2>/dev/null || true
```
