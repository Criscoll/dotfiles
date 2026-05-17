# Python Type Checking Reference — mypy

## Setup

```bash
uv add --dev mypy
uv run mypy scripts/   # or whatever source directory applies
```

## Recommended `pyproject.toml` Config

```toml
[tool.mypy]
python_version = "3.11"
strict = true
[[tool.mypy.overrides]]
module = "some_untyped_lib.*"
ignore_missing_imports = true
```

Install stubs for libraries that publish them; suppress with `ignore_missing_imports` for those that don't:

```bash
uv add --dev pandas-stubs types-openpyxl
```

## Common Strict Mode Issues

- **Bare `dict` or `list` in signatures** — needs `dict[str, Any]`, `list[str]`, etc.
- **Functions missing return annotations** — add `-> None` (or the correct return type) to every function
- **`json.load()` returning `Any`** — annotate the result as `dict[str, Any]` and add `# type: ignore[no-any-return]`
- **`df.iterrows()` index type** — see ref-pandas.md; use `enumerate` instead of indexing the row label directly
