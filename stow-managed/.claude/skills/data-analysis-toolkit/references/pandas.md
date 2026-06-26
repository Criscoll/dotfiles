# pandas — When You're Stuck With It

Reach for this file when you've already decided polars won't work. Convert at the boundary, keep pandas contained, and don't let it sprawl.

## When It's Acceptable to Reach for pandas

- **Legacy codebase** — the project already uses pandas and converting mid-stream creates confusion
- **Library requirement** — ydata-profiling, scikit-learn, statsmodels, matplotlib/seaborn all prefer or require pandas/numpy
- **Quick one-off EDA** — a single-file analysis where you know the data is small and the code won't be reused
- **Prototype first, polish later** — pandas has broader docs and more StackOverflow answers for unusual operations

## Key Gotchas

### 1. Chained Indexing (Copy vs View)

The most common source of subtle bugs:

```python
# BAD — may modify a copy, silently does nothing
df[df['val'] > 0]['col'] = 5

# GOOD — always works
df.loc[df['val'] > 0, 'col'] = 5
```

Rule: if you're filtering *and* assigning in one expression, use `.loc[row_mask, col_name]`.

### 2. `inplace=True` is Deprecated

Pandas 2.x warns on this. The non-inplace form is cleaner anyway:

```python
# Avoid
df.dropna(inplace=True)
df.rename(columns={'old': 'new'}, inplace=True)

# Instead
df = df.dropna()
df = df.rename(columns={'old': 'new'})
# Or use assign for adding columns
df = df.assign(new_col=df['a'] + df['b'])
```

### 3. GroupBy Returns MultiIndex

```python
# Returns MultiIndex columns
agg = df.groupby('cat').agg({'val': ['sum', 'mean', 'count']})
# agg.columns: MultiIndex([('val', 'sum'), ('val', 'mean'), ('val', 'count')])

# Flatten
agg.columns = ['_'.join(col).strip() for col in agg.columns.values]
agg = agg.reset_index()
```

### 4. `pd.read_csv()` dtype Inference

Auto-inference is fragile. It converts ZIP codes to int, date-like strings to datetime (even when they're not), and silently coerces mixed-type columns:

```python
# Specify types explicitly, especially for columns that look numeric but aren't
df = pd.read_csv('data.csv', dtype={
    'zip_code': str,
    'id': str,
    'flag': bool
}, low_memory=False)
```

### 5. `pd.to_datetime()` with format=

Without `format=`, pandas tries multiple parsers, which is slow on large datasets:

```python
# SLOW on large data
df['date'] = pd.to_datetime(df['date'])

# FAST — specify the exact format
df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')
```

### 6. `.apply()` is a Loop

```python
# Avoid — Python loop in disguise
df['name_len'] = df['name'].apply(len)

# Instead — vectorized
df['name_len'] = df['name'].str.len()

# If you really need a complex function, try .map() or vectorized numpy
```

### 7. `pd.concat()` in a Loop

Appending to a DataFrame in a loop creates a new copy each iteration — O(n²) cost:

```python
# BAD
result = pd.DataFrame()
for chunk in chunks:
    result = pd.concat([result, chunk])  # copies entire result each time

# GOOD
pieces = []
for chunk in chunks:
    pieces.append(chunk)
result = pd.concat(pieces)
```

## Conversion Boundary Pattern

Keep polars as the primary type, convert to pandas only at library boundaries:

```python
import polars as pl
import pandas as pd

# Work in polars
df = pl.read_csv("data.csv")
cleaned = df.filter(pl.col('val').is_not_null())

# Convert at the pandas boundary — scikit-learn needs numpy
X = cleaned.select(pl.col(features)).to_numpy()
y = cleaned.select(pl.col(target)).to_numpy().ravel()

# Or for ydata-profiling
profile = ProfileReport(cleaned.to_pandas(), title="EDA")
```

<!-- last-verified: 2026-06-26 -->