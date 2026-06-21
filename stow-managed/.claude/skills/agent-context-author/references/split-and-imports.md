# Split & Import Mechanics

## .claude/rules/ Structure

Claude Code discovers `.md` files **recursively** in `.claude/rules/`. Files without
a `paths:` frontmatter field load at launch alongside CLAUDE.md. Path-scoped files
trigger only when the agent reads a matching file — zero token cost until then.

```
.claude/rules/
├── code-style.md          # always loaded
├── testing.md             # always loaded
├── security.md            # always loaded (hard rules)
├── api-design.md          # path-scoped to src/api/**
├── database.md            # path-scoped to migrations/, models/
└── frontend/
    ├── react-conventions.md
    └── css-patterns.md
```

## Path-Scoped Rule Frontmatter

```yaml
---
paths:
  "src/api/**/*.ts"
  "src/api/**/*.tsx"
---

# API Rules
- All endpoints must validate input — missing validation is a security boundary, not a style issue
- Error response shape: { error, message, code }
```

Glob patterns: `**/*.ts`, `src/**/*`, `src/**/*.{ts,tsx}` (brace expansion supported).

## Monorepo Pattern

Place a short CLAUDE.md (30–100 lines) in each package:

```
/packages/web/CLAUDE.md      → "Next.js 16, pnpm, Vitest"
/packages/api/CLAUDE.md      → "Fastify 5, bun, node:test"
/cli/CLAUDE.md               → "CLI tool, oclif framework"
```

Root CLAUDE.md covers workspace-level rules. Package files add and merge in.
Remember the compaction caveat: package-level files reload on file-read, not after
`/compact` — cross-cutting rules that must persist go in the root.

## @import Syntax (CLAUDE.md only)

```markdown
@path/to/file
```

Imported files expand inline at launch. Rules:
- Paths resolve relative to the file containing the import
- Absolute and `~`-prefixed paths supported
- Max recursion: 4 hops
- Code-fenced `@path` is treated as literal text, not an import

## Multi-Tool Projects (AGENTS.md as Source of Truth)

When the project uses multiple agents (Claude Code + Codex + Cursor + Copilot),
put shared context in `AGENTS.md` and make `CLAUDE.md` a thin stub:

```markdown
@AGENTS.md

## Claude-specific
- Use plan mode for changes under src/billing/
```

Or symlink: `ln -s AGENTS.md CLAUDE.md`

AGENTS.md uses nearest-file-wins: place one per package in a monorepo. The agent
reads the closest AGENTS.md to the file being edited.
