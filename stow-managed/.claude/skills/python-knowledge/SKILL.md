---
name: python-knowledge
description: Apply Python best practices when reading, writing, debugging, or understanding Python code — covers build toolchain, package management, and environment setup. Auto-invoke BEFORE writing or running any Python code, reading/editing any .py file, or executing any uv/pip/poetry/virtualenv command. Trigger phrases: "python", "pip install", "virtualenv", "pyproject.toml", "requirements.txt", ".py file", "uv", "poetry".
disable-model-invocation: false
---

You are assisting with Python code. Apply the following core rules, then load additional reference files as directed below.

## Always Apply

**File naming:** Before creating any `.py` file, verify the stem does not collide with a stdlib module name (`inspect`, `typing`, `os`, `sys`, `io`, `csv`, `json`, `re`, `math`, `time`, `copy`, `abc`, etc.). Python adds the script's directory to `sys.path` — a file named `csv.py` shadows the stdlib `csv` for all imports in that process.

**Toolchain:** Always prefer `uv` over `pip`, `pip-tools`, or manual venv management. Core commands:

| Task | Command |
|---|---|
| Add a dependency | `uv add <package>` |
| Add a dev dependency | `uv add --dev <package>` |
| Install all deps | `uv sync` |
| Run in the venv | `uv run <script>` |
| Run a tool without installing | `uvx <tool>` |

Never use: `pip install`, `python -m venv`, `pip freeze`, `pip install -r requirements.txt`.

## Load Reference Files When Relevant

Read these files using the Bash tool (`cat "$CLAUDE_SKILL_DIR/<file>"`). Do not guess their contents — read them.

- **references/toolchain.md** — load when: starting a new project, migrating from `requirements.txt`/`setup.py`, setting up dev tools, or any question about uv beyond the table above.
- **references/typing.md** — load when: mypy is mentioned, type annotations are being added or debugged, strict mode errors appear, or the user asks about type checking setup.
- **references/pandas.md** — load when: pandas, DataFrame, Series, `read_csv`, `iterrows`, or CSV files from external sources are involved.
