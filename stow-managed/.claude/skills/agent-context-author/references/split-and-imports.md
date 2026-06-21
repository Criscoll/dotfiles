# Split & Import Mechanics

## Subdirectory CLAUDE.md (default)

Place a short CLAUDE.md (30–100 lines) in each subdirectory or package that
has its own distinct conventions:

```
/packages/web/CLAUDE.md      → "Next.js 16, pnpm, Vitest"
/packages/api/CLAUDE.md      → "Fastify 5, bun, node:test"
/cli/CLAUDE.md               → "CLI tool, oclif framework"
```

Root CLAUDE.md covers workspace-level rules. Subdirectory files add to and
refine the root context — they do not replace it.

**Cross-harness compatible:**
- Claude Code lazy-loads them natively when the agent first reads a file in
  that directory
- Pi loads them via the `subdir-context` extension (same trigger: first file
  read in the directory)

**Compaction caveat:** Subdirectory CLAUDE.md files do NOT survive `/compact`.
They reload only when the agent next reads a file in that directory. Rules that
must survive compaction belong in the root file.

---

## Which to use

| Situation | Mechanism |
|---|---|
| Cross-harness (Claude Code + pi) | Subdirectory CLAUDE.md |
| Need path-glob scoping (`**/*.test.ts`) | `.claude/rules/` with `paths:` frontmatter |
| Claude Code-only project | Either; prefer subdirectory CLAUDE.md for simplicity |
| Rules must survive `/compact` | Root CLAUDE.md (neither alternative survives) |

---

## .claude/rules/ (Claude Code only)

Claude Code discovers `.md` files **recursively** in `.claude/rules/`. Files without
a `paths:` frontmatter field load at launch alongside CLAUDE.md. Path-scoped files
trigger only when the agent reads a matching file — zero token cost until then.

Pi does not read `.claude/rules/` — use this mechanism only for Claude Code-only
projects or when path-glob scoping is required.

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

### Path-Scoped Rule Frontmatter

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

---

## @import Syntax (CLAUDE.md only)

```markdown
@path/to/file
```

Imported files expand inline at launch. Rules:
- Paths resolve relative to the file containing the import
- Absolute and `~`-prefixed paths supported
- Max recursion: 4 hops
- Code-fenced `@path` is treated as literal text, not an import

---

## Multi-Tool Projects (AGENTS.md as Source of Truth)

When the project uses multiple agents (Claude Code + Codex + Cursor + Copilot),
put shared context in `AGENTS.md` and make `CLAUDE.md` a thin stub:

```markdown
@AGENTS.md

## Claude-specific
- Use plan mode for changes under src/billing/
```

Or symlink: `ln -s AGENTS.md CLAUDE.md`

**Note on nearest-file-wins:** Tools like Codex and Amp read the closest
`AGENTS.md` to the file being edited natively. Claude Code does **not** do
this — it reaches `AGENTS.md` only via an explicit `@AGENTS.md` import in
`CLAUDE.md`. Place the `@AGENTS.md` import in the root `CLAUDE.md`; do not
rely on nearest-file resolution for Claude Code.
