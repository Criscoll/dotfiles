# Global ESLint Config with Per-Repo Override

## The Problem

The lint hook (`lint-file.sh`) runs `npx eslint` from whatever CWD it inherits. This is
fine for Claude Code hooks (CWD = project dir) but breaks for the pi `lint-on-edit` extension,
which invokes the script with CWD set to pi's npm tmp directory
(`~/.pi/agent/tmp/extensions/npm/<hash>/`). ESLint searches for config walking up from CWD
and fails with "couldn't find eslint.config.*" because:

1. No global ESLint config exists anywhere on the machine
2. The pi tmp dir's ancestor path never crosses into the project's repo tree, so even a
   repo-level config would never be found

Result: every TypeScript lint triggered by pi emits an ESLint error and no linting happens.

## The Goal

- **Global baseline**: a TypeScript-aware ESLint config that applies to any `.ts`/`.js` file
  on the machine when no closer config exists
- **Per-repo override**: repos can drop their own `eslint.config.mjs` to replace or extend
  the global config for their files specifically
- **Consistent search root**: `lint-file.sh` anchors ESLint's config search to the edited
  file's directory, not the caller's CWD

## Proposed Solution

### 1. Fix `lint-file.sh` — anchor search to file's directory

`stow-managed/bin/agent_scripts/lint-file.sh`, TypeScript/JS case:

```bash
_find_eslint_config() {
  local dir="$1"
  while [[ "$dir" != "/" ]]; do
    for ext in js mjs cjs ts; do
      [[ -f "$dir/eslint.config.$ext" ]] && return 0
    done
    dir="$(dirname "$dir")"
  done
  return 1
}

*.ts|*.tsx|*.js|*.jsx|*.mjs)
  if command -v npx >/dev/null 2>&1; then
    abs_file=$(realpath "$file")
    file_dir=$(dirname "$abs_file")
    if _find_eslint_config "$file_dir"; then
      # Local config found — let ESLint auto-discover it normally
      (cd "$file_dir" && npx eslint --fix "$abs_file" 2>&1) || true
    elif [[ -f "$HOME/.config/eslint/eslint.config.mjs" ]]; then
      # No local config — fall back to global
      (cd "$HOME/.config/eslint" && npx eslint --config "$HOME/.config/eslint/eslint.config.mjs" --fix "$abs_file" 2>&1) || true
    fi
  fi
  ;;
```

Wrapping in a subshell `(cd ... && ...)` keeps the cd scoped and doesn't affect the rest of
the script. The `_find_eslint_config` helper stops as soon as it finds any `eslint.config.*`.

### 2. Self-contained global ESLint home at `~/.config/eslint/`

Three files, all tracked in this repo under `stow-managed/.config/eslint/`:

**`eslint.config.mjs`**
```js
// @ts-check
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
);
```

`@eslint/js` is bundled with ESLint itself — no extra install. `typescript-eslint` provides
the parser and plugin in a single package.

**`package.json`**
```json
{
  "private": true,
  "dependencies": {
    "typescript-eslint": "<pinned exact version>"
  }
}
```

**`package-lock.json`** — committed lockfile for exact reproducibility.

### 3. Per-repo configs (pattern)

Because `~/.config/eslint/` is NOT in any file's ancestor path, ESLint cannot auto-discover
the global config by walking up. `lint-file.sh` handles the fallback explicitly (see §1).

For per-repo configs, two behaviors:

**Replace global** (default): add `eslint.config.mjs` at the repo root. `_find_eslint_config`
will find it and ESLint auto-discovers it. The global config is not used.

**Cascade (global base + repo additions)**: explicitly import and spread:
```js
import globalConfig from '/home/cristian/.config/eslint/eslint.config.mjs';
export default [...globalConfig, {
  // repo-specific overrides
}];
```

Note: absolute path needed since `~/.config/eslint/` is not in the repo tree.

## Bootstrap on a New Machine

After running stow:
```bash
cd ~/.config/eslint && npm ci
```

This should be added to the new-machine bootstrap checklist (currently in `resync.md` or
the main README).

## Files to Create / Modify

| Action | Path |
|--------|------|
| Modify | `stow-managed/bin/agent_scripts/lint-file.sh` |
| Create | `stow-managed/.config/eslint/eslint.config.mjs` |
| Create | `stow-managed/.config/eslint/package.json` |
| Create | `stow-managed/.config/eslint/package-lock.json` (after `npm install`) |

## Version Pinning Note

The `typescript-eslint` version must be compatible with whatever `eslint` version is resolved
by `npx eslint`. Check `eslint --version` on the machine before pinning. As of the time this
was written, ESLint v10.5.0 is installed (per CLAUDE.md). Verify compatible `typescript-eslint`
release before committing.

## Why `~/.config/eslint/` and Not `~/package.json`

Putting a `package.json` directly at `~` risks npm treating home as a project (affects
`npm install`, `npm start`, editor project scanning). `~/.config/eslint/` is a standard XDG
config location and isolates the ESLint setup completely. The tradeoff is that `lint-file.sh`
must handle the fallback explicitly rather than relying on ESLint's natural walk-up.

## Why Not Just Silence the Error

The `|| true` at the end of the current `npx eslint` call already suppresses non-zero exits.
The errors are visible in session transcripts but don't block anything. This fix is about
actually getting linting to work, not about hiding the error.
