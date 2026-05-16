---
name: python-knowledge
description: Apply Python best practices when reading, writing, debugging, or understanding Python code — covers build toolchain, package management, and environment setup. Trigger phrases: "python", "pip install", "virtualenv", "pyproject.toml", "requirements.txt", ".py file", "uv", "poetry".
disable-model-invocation: false
---

You are assisting with Python code. Apply the following guidelines.

## Build Toolchain — Use uv

Always prefer `uv` over `pip`, `pip-tools`, or manual `venv` management.

**Why:** uv is significantly faster, manages virtualenvs automatically, and provides a unified workflow for dependency resolution, locking, and project management.

### Key uv commands

| Task | Command |
|---|---|
| Create/init a project | `uv init` |
| Add a dependency | `uv add <package>` |
| Remove a dependency | `uv remove <package>` |
| Install all deps (from lockfile) | `uv sync` |
| Run a script in the venv | `uv run <script>` |
| Run a tool without installing | `uvx <tool>` |
| Lock dependencies | `uv lock` |
| Build a package | `uv build` |

### Do not use

- `pip install` — use `uv add` instead
- `python -m venv` / `virtualenv` — uv creates and manages the `.venv` automatically
- `pip freeze > requirements.txt` — use `uv lock` to generate `uv.lock`
- `pip install -r requirements.txt` — use `uv sync` instead

### When you see legacy patterns, suggest the uv equivalent

If the codebase uses `requirements.txt` or `setup.py`, note the migration path:
- `uv init` to create `pyproject.toml`
- `uv add` each dependency
- `uv lock` to generate the lockfile
- Remove `requirements.txt` once migrated (or keep it as an export via `uv export`)

### Running code

Prefer `uv run python ...` over activating the venv manually. This ensures the correct venv is always used without shell-level activation.
