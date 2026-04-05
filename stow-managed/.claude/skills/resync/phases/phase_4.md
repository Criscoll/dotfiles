# Phase 4: Sensitive Data Audit

The `diff_check.sh` script run in Phase 3 already produced a **Sensitive Scan** section at the end of its output. Use that output here — do not re-run the scan.

Review the sensitive scan results:

- Any `POSSIBLE SECRETS FOUND` entries must be investigated. Check each match:
  - Is it a real credential value, or just a variable name / example string / comment?
  - Is it inside a submodule (powerlevel10k, .tmux/plugins) — these are excluded by the script but flag if something was missed
  - Does it appear in a file that would be applied to another machine?

- Also check for:
  - Private or company-internal paths hard-coded in config files
  - Anything that would be a problem if this repo were made public or cloned to an untrusted machine

**This is independent of sync state.** Sensitive data in `stow-managed/` is a problem in its own right — the repo may already be leaking secrets regardless of what this machine has locally.

Append findings to `/tmp/resync-audit.md` under a `## Sensitive Data in Repo` heading. If nothing actionable is found, note that explicitly.

---

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 4 done
```

Then fetch and execute the phase it returns.
