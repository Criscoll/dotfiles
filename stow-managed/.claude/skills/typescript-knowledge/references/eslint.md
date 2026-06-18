# ESLint Reference — Flat Config

## Available Command

ESLint is invoked via `npx eslint` (Node managed by `nvm`). The current version is `eslint` v10.5.0.

```bash
# Lint and auto-fix a file
npx eslint --fix <file>

# Lint with a specific config file
npx eslint --config eslint.config.js --fix <file>
```

## Flat Config (`eslint.config.js` / `eslint.config.mjs`)

ESLint v9+ uses flat config. The config file exports an array of config objects:

```javascript
// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import tsParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": "warn",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.js.map"],
  },
];
```

## Key Rules to Enforce

| Rule | Severity | Purpose |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | `error` | No `any` — use `unknown` |
| `@typescript-eslint/no-unused-vars` | `error` | Catch dead code (allow `_` prefix) |
| `@typescript-eslint/explicit-function-return-type` | `warn` | Encourage explicit return types on public functions |
| `no-console` | `warn` | Catch debugging leftovers |

## Running Outside a Project

ESLint requires a project with a config file. For one-off files outside a project, ESLint may fail with config resolution errors. In that case, the lint-on-edit hook silently skips the file — ESLint is only applied to files inside a configured project.

## Performance Note

TypeScript-aware rules (requiring `project: "./tsconfig.json"`) are slower than syntax-only rules because they need the full type checker. For per-edit hooks, prefer syntax-only rules when possible. Reserve full type-checking (tsc --noEmit) for CI or dedicated lint passes.