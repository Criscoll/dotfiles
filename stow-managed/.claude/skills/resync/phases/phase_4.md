# Phase 4: Sensitive Data Audit

Read `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md` and substitute it in all commands below.

Scan the contents of `$REPO_DIR/stow-managed/` itself for anything sensitive — independently of what the local machine has:

```bash
grep -rn -iE "(api_key|api_token|auth_token|password|secret|credential|private_key)\s*=" \
  $REPO_DIR/stow-managed/

grep -rn -E "(token\s*=|password\s*=|secret\s*=)" \
  $REPO_DIR/stow-managed/
```

Also look for:
- Private or company-internal paths
- Anything that would be a problem if this repo were made public or cloned to another machine

**This is independent of sync state.** Sensitive data in `stow-managed/` is a problem in its own right — it means the repo may already be leaking secrets. Flag these prominently regardless of what the local machine has.

Append findings to `/tmp/resync-audit.md` under a `## Sensitive Data in Repo` heading. If nothing is found, note that explicitly.

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 4 done
```

Then fetch and execute the phase it returns.
