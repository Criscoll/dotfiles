---
name: typescript-knowledge
description: >-
  Apply TypeScript best practices when reading, writing, debugging, or understanding TypeScript/JavaScript code — covers strict mode, type system, build toolchain, and linting. Auto-invoke BEFORE writing or running any .ts, .tsx, .js, .jsx, or .mjs file, or executing any eslint, tsc, npx, or node command. Trigger phrases: "typescript", "ts", "tsx", "javascript", "js", "eslint", "tsc", "typeerror", "type guard", "interface", "type alias", "npx", "node", "strict mode", "flat config", "any type", "unknown type".
disable-model-invocation: false
---

You are assisting with TypeScript/JavaScript code. Apply the following core rules, then load additional reference files as directed below.

## Always Apply

**Strict mode:** All TypeScript projects must use `strict: true` in `tsconfig.json`. This enables `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, and `alwaysStrict`.

**Ban `any`:** Never use `any`. Use `unknown` when the type is genuinely not known at authoring time — it forces runtime type checks before use. Use generics or branded types for domain-specific constraints.

**Prefer `interface` for public API shapes:** Use `interface` over `type` for object shapes that are part of a module's public API. `interface` supports declaration merging and produces clearer error messages. Use `type` for unions, intersections, mapped types, and utility types.

**Type guards over type assertions:** Prefer type guards (`x is Foo`) or discriminated unions over type assertions (`as Foo`). Assertions silence the compiler without verifying at runtime. Only use `as` when you have proven the invariant separately (e.g., a Zod parse upstream).

**Toolchain:** JavaScript/TypeScript tooling is managed via `nvm` and `npx`. Node.js version is managed by `nvm` — do not install global tools.

| Task | Command |
|---|---|
| Switch Node version | `nvm use <version>` |
| Run ESLint | `npx eslint --fix <file>` |
| Run tsc | `npx tsc --noEmit` |
| Run formatter | `npx prettier --write <file>` (if configured) |

Never use: global `npm install -g`, `ts-node`, `tsx` (runtime), or `npm link`.

**No implicit any from parameters or return values.** Every function signature must have explicit parameter types. Return types should be explicit in public API functions, inferred in private helpers.

**No non-null assertions (`!`).** Use `!` only when the invariant is proven by an immediately preceding check that TypeScript cannot narrow. Prefer early returns, `??`, or `?.` for null handling.

**Prefer `const` over `let`.** Use `let` only when the variable is reassigned.

## Load Reference Files When Relevant

Read these files using the Bash tool (`cat "$CLAUDE_SKILL_DIR/<file>"`). Do not guess their contents — read them.

- **references/eslint.md** — load when: ESLint is mentioned, flat config is being set up or modified, lint rules are being discussed, or lint errors appear.