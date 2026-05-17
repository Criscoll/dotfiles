# Python pandas Reference

## `iterrows()` Index Type

`df.iterrows()` yields `tuple[Hashable, Series]`, not `tuple[int, Series]`. Arithmetic on the index (e.g. `r + 1`) fails strict mypy because `Hashable + int` is not valid.

```python
# Wrong — r is Hashable, not int
for r, row in df.iterrows():
    do_something(r + 1)

# Correct — i is unambiguously int
for i, (_, row) in enumerate(df.iterrows(), start=1):
    do_something(i)
```

## CSV Encoding — Use `utf-8-sig` for External Sources

Files from Excel, Windows tools, or bank exports often include a UTF-8 BOM (`﻿`). `pd.read_csv(path)` silently includes it in the first column name, causing subtle lookup and merge failures.

```python
pd.read_csv(path, encoding="utf-8-sig")  # strips BOM; safe when no BOM is present
```

Default to `utf-8-sig` for any CSV sourced outside your own code.
