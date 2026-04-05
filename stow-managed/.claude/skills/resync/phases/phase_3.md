# Phase 3: Diff and Semantic Analysis

Read `HOME_DIR` and `REPO_DIR` from the `## Confirmed Paths` section of `/tmp/resync-audit.md` and substitute them in all commands below.

For each `EXISTS_LOCALLY` file, produce a diff:
```bash
diff $HOME_DIR/<file> $REPO_DIR/stow-managed/<path>
```

Analyse it **semantically** — do not treat it as a simple line-count problem. Ask:

- Are the same aliases, functions, or keybindings present on both sides but in different locations within the file?
- Is the local version a superset of the repo version (has everything from repo plus additions)?
- Is the repo version a superset of the local version?
- Are there genuinely conflicting values — different colorscheme, different key bound to a different action, contradictory settings?
- Does the local version have content that clearly belongs on this machine only — machine-specific paths, work-specific aliases, env vars that would break on another machine?

## Flag sensitive or machine-specific local content

Look for:
- API keys, tokens, passwords: `export API_KEY=`, `token =`, `password =`, `secret`
- Paths specific to this machine: `$HOME_DIR/`, company-internal paths
- Work-specific aliases or environment variables
- Anything that would be wrong or broken if applied to a different machine

These items must be extracted into a `.local` file, not left in the shared config.

Append diff findings and flagged content to `/tmp/resync-audit.md`.

## Next

```bash
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 3 done
```

Then fetch and execute the phase it returns.
