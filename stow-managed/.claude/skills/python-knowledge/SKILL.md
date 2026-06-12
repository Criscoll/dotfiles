---
name: python-knowledge
description: >-
  Apply Python best practices when reading, writing, debugging, or understanding Python code — covers build toolchain, package management, and environment setup. Auto-invoke BEFORE writing or running any Python code, reading/editing any .py or .pyi file, or executing any uv/pip/poetry/virtualenv command. Trigger phrases: "python", "pip install", "virtualenv", "pyproject.toml", "requirements.txt", ".py file", ".pyi", "uv", "uv run", "poetry", "fastapi", "django", "flask", "pydantic", "pytest", "ruff", "mypy".
disable-model-invocation: false
---

You are assisting with Python code. Apply the following core rules, then load additional reference files as directed below.

## Always Apply

**File naming:** Before creating any `.py` or `.pyi` file, verify the stem does not collide with a stdlib module name. Python adds the script's directory to `sys.path` — a file named `csv.py` shadows the stdlib `csv` for all imports in that process. Check with: `python3 -c "import sys; print('csv' in sys.stdlib_module_names)"` (replace `csv` with the proposed stem).

**Toolchain:** Always prefer `uv` over `pip`, `pip-tools`, or manual venv management. Core commands:

| Task | Command |
|---|---|
| Add a dependency | `uv add <package>` |
| Add a dev dependency | `uv add --dev <package>` |
| Install all deps | `uv sync` |
| Run in the venv | `uv run <script>` |
| Run a tool without installing | `uvx <tool>` |
| Pin Python version | `uv python pin 3.12` |

Never use: `pip install`, `python -m venv`, `pip freeze`, `pip install -r requirements.txt`.

**pyproject.toml is canonical.** Project metadata, dependencies, and tool config (ruff, mypy, pytest) all go in `pyproject.toml`. Never create `setup.py`, `setup.cfg`, or `requirements.txt` in a new project.

**Use `uv run python`, not bare `python`.** Bare `python` resolves to the system interpreter, not the project venv. Always prefix with `uv run` to guarantee the correct environment.

## Load Reference Files When Relevant

Read these files using the Bash tool (`cat "$CLAUDE_SKILL_DIR/<file>"`). Do not guess their contents — read them.

- **references/toolchain.md** — load when: starting a new project, migrating from `requirements.txt`/`setup.py`, setting up dev tools, or any question about uv beyond the table above.
- **references/typing.md** — load when: mypy is mentioned, type annotations or type hints are being added or debugged, strict mode errors appear, `.pyi` stub files are involved, or the user asks about type checking setup.
- **references/pandas.md** — load when: pandas, DataFrame, Series, `read_csv`, `iterrows`, or CSV files from external sources are involved.
