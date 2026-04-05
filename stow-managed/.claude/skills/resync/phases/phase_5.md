# Phase 5: Classify Each File

Using the inventory (Phase 1), timeline (Phase 2), and diff/audit findings (Phases 3–4), assign each non-symlinked file a category:

| Category | Meaning |
|---|---|
| `CLEAN_APPLY` | Repo version can be applied directly via stow; local has nothing new or different that matters |
| `LOCAL_MIGRATION` | Local has machine-specific or sensitive content that must be extracted into a `.local` file before stow is applied |
| `CONFLICT` | Both sides have changed the same setting in incompatible ways; needs explicit user decision |
| `LOCAL_ONLY_ADDITIONS` | Local file has meaningful content the repo doesn't have — assess whether it's machine-specific or generic enough to upstream |
| `MISSING_LOCALLY` | File exists in repo but not on this machine; straightforward to apply |
| `SENSITIVE_IN_REPO` | Repo version contains content that should not be tracked; flag for remediation before proceeding |

For `CONFLICT` files, record the nature of the conflict clearly — incompatible values, structural divergence, etc. This will appear in the plan.

For `LOCAL_ONLY_ADDITIONS`, note your assessment: is the content machine-specific (stay local) or generic enough to consider upstreaming from a primary device?

Append final classifications to `/tmp/resync-audit.md`.

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 5 done
```

Then fetch and execute the phase it returns.
