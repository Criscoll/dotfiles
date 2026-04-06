# Phase 3: Diff and Semantic Analysis

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md`.

Run the diff script against the `EXISTS_LOCALLY` files identified in Phase 1:

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/diff_check.sh $HOME_DIR $REPO_DIR
```

The script reads `/tmp/resync-exists-locally.txt` and outputs two sections:

1. **Diff Results** — one line per file (`IDENTICAL` or `DIFFERS`), with the diff shown for any that differ
2. **Sensitive Scan** — grep results for credential patterns across all of `stow-managed/` (feeds Phase 4)

---

## Analyse diff output semantically

For each `DIFFERS` file, do not treat it as a simple line-count problem. Ask:

- Are the same aliases, functions, or keybindings present on both sides but in different locations?
- Is the local version a superset of the repo version (has everything plus additions)?
- Is the repo version a superset of the local version?
- Are there genuinely conflicting values — different colorscheme, different key bound to a different action, contradictory settings?
- Does the local version have content that clearly belongs on this machine only — machine-specific paths, work-specific aliases, env vars that would break on another machine?

## Flag sensitive or machine-specific local content

Look for:
- API keys, tokens, passwords: `export API_KEY=`, `token =`, `password =`, `secret`
- Paths specific to this machine: company-internal paths, absolute paths under `$HOME_DIR`
- Work-specific aliases or environment variables
- Anything that would be wrong or broken if applied to a different machine

These items must be extracted into a `.local` file, not left in shared config.

Append diff findings and flagged content to `/tmp/resync-audit.md`.

---

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 3 done
```

Then fetch and execute the phase it returns.
