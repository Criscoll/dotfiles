# Agent Toolchain Integration: Hooks + Skills

Terse reference for wiring TypeScript, Python, and Node tooling into Claude Code so
it self-corrects on every edit. Written so another agent can implement.

## Architecture

Three layers, each with a distinct job:

| Layer | Mechanism | Job |
|---|---|---|
| `CLAUDE.md` | Project instructions | Declare what the project values (strict types, no `any`, annotated defs) |
| **Hooks** | `~/.claude/settings.json` / project `.claude/settings.json` | Enforce mechanically — run linter/type-checker per-edit, feed errors back |
| **Skills** | `~/.claude/skills/<name>/SKILL.md` | Teach agent how to write idiomatic code per language |

Hooks give immediate feedback → agent self-corrects on next turn. Skills prevent
the mistake from happening in the first place.

---

## Hooks Setup

### Shared PostToolUse (for `settings.json`)

One hook config, routes by file extension:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE=\"$CLAUDE_TOOL_INPUT_file_path\"; case \"$FILE\" in *.ts|*.tsx) npx eslint --fix \"$FILE\" 2>&1 ;; *.py) ruff check --fix \"$FILE\" 2>&1 ;; *.js|*.jsx|*.mjs) npx eslint --fix \"$FILE\" 2>&1 ;; esac"
          }
        ]
      }
    ]
  }
}
```

**Key constraints:**
- File-scoped only (`$CLAUDE_TOOL_INPUT_file_path`) — full-project checks are too slow per-edit
- `--fix` (or `--fix --quiet`) used where available so agent only sees remaining errors
- Heavy checks (`tsc --noEmit`, `mypy $FILE`) go in a **Stop hook** or CI, not PostToolUse

### PostToolUseFailure hook

Optional but useful — fires when a tool errors. Can log or trigger a retry.

### Stop hook (end-of-turn quality gate)

Runs after Claude finishes its full response. Suitable for:
- `tsc --noEmit` (full-program type check)
- `mypy src/` (full-project Python types)
- `pytest --failed-first` (run tests on changed areas)

Example:
```json
{
  "matcher": "Stop",
  "hooks": [{ "type": "command", "command": "tsc --noEmit 2>&1" }]
}
```

---

## Skills to Install

### TypeScript

| Skill | Purpose |
|---|---|
| [typescript-best-practices](https://mcpmarket.com/tools/skills/typescript-best-practices) | Idiomatic TS, strict patterns, generics |
| [typescript-expert](https://awesomeskill.ai/skill/claude-skills-generator-typescript-expert) | Advanced types, branded types, discriminated unions, tRPC |

Alternatively, inline a "TypeScript Standards" section in `CLAUDE.md` covering:
- `strict: true` in tsconfig, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- Ban `any` — use `unknown` + type guards
- Prefer interfaces over type aliases for public API shapes

### Python

| Skill | Purpose |
|---|---|
| [python-pro](https://jeffallan.github.io/claude-skills/skills/language/python-pro/) | Type-annotated code, mypy strict mode, pytest, ruff |
| [python-code-quality](https://mcpmarket.com/tools/skills/python-code-quality-with-ruff-pyright) | Ruff + Pyright linting/type checking |

### Full plugin (alternative to manual hooks)

| Plugin | Covers |
|---|---|
| [claude-python-plugin](https://pypi.org/project/claude-python-plugin/) | uv + ruff + mypy/ty + pytest — single install |
| [claude-md-plugin](https://github.com/anthropics/claude-code-md-plugin) | CLAUDE.md generation and management (official) |

Check if `npx @anthropic-ai/claude-code-md-plugin` is installed for the latter.

---

## Implementation Steps

1. **Add the PostToolUse hook** to the machine's `~/.claude/settings.json` (or project `.claude/settings.json` if repo-specific)
2. **Install skills** — copy SKILL.md into `~/.claude/skills/<name>/` (these are in the dotfiles stow-managed tree)
3. **Update CLAUDE.md** with language-specific expectations (type strictness, test conventions, import style)
4. **Test** — ask agent to write a deliberately loose function in each language, watch hook fire, verify self-correction
5. **Iterate** — if hook output is too noisy, add `--quiet` or increase warning thresholds. If agent keeps making the same mistakes, add a skill

## Tool Versions (as of mid-2026)

- **TypeScript checker**: `tsc` (included with typescript npm package)
- **TS linter**: ESLint 9+ (flat config) with `@typescript-eslint`
- **Python linter/formatter**: `ruff` (uvx ruff or pip install ruff)
- **Python type checker**: `mypy` (stable) or `ty` (Astral, Rust-based, faster)
- **Python env/package**: `uv`
- **Python test**: `pytest`
