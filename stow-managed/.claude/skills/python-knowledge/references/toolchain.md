# Python Toolchain Reference — uv

## Full Command Reference

| Task | Command |
|---|---|
| Create/init a project | `uv init` |
| Add a dependency | `uv add <package>` |
| Add a dev dependency | `uv add --dev <package>` |
| Remove a dependency | `uv remove <package>` |
| Install all deps (from lockfile) | `uv sync` |
| Run a script in the venv | `uv run <script>` |
| Run a tool without installing | `uvx <tool>` |
| Lock dependencies | `uv lock` |
| Build a package | `uv build` |

## Dev-Only Dependencies

Use `uv add --dev` for type stubs, linters, formatters, and test tools. They go into `[dependency-groups] dev`, not `[project.dependencies]`, and are excluded from production installs.

```bash
uv add --dev mypy ruff pytest pandas-stubs types-openpyxl
```

## Migrating from Legacy Patterns

If the codebase uses `requirements.txt` or `setup.py`:
1. `uv init` — creates `pyproject.toml`
2. `uv add <pkg>` for each runtime dependency
3. `uv add --dev <pkg>` for each dev dependency
4. `uv lock` — generates `uv.lock`
5. Remove `requirements.txt` once migrated, or keep it as a read-only export via `uv export`

## Running Code

Prefer `uv run python ...` over activating the venv manually — always uses the correct venv without shell-level activation.
