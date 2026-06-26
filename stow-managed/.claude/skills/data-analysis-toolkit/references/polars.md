# polars — Conventions, Gotchas, and Anti-Patterns

## Core Conventions

### Always Start Lazy for Multi-Step Work

```python
lazy = pl.scan_csv("large.csv")       # lazy — no data loaded
lazy = pl.scan_parquet("data/*.pq")   # lazy — works with partitioned parquet

query = (lazy
    .filter(pl.col('date') >= '2025-01-01')
    .group_by('region')
    .agg(pl.col('revenue').sum())
    .sort('region')
)
result = query.collect()  # single optimized pass
```

Rule: `.scan_csv()` / `.scan_parquet()` for lazy. `pl.read_csv()` / `pl.read_parquet()` for eager (small files). If you're chaining more than 2 operations, go lazy.

### Expression-Based API — No More `df[df.a > 0]`

Every operation is an expression inside a context method:

| Operation | Expression |
|---|---|
| Filter rows | `df.filter(pl.col('val') > 0)` |
| Add/modify columns | `df.with_columns(pl.col('a').alias('b'))` |
| Select columns | `df.select(['col1', 'col2'])` or `df.select(pl.col('^col_.*$'))` |
| Aggregation | `df.group_by('cat').agg(pl.col('val').sum())` |
| Sort | `df.sort('col', descending=True)` |

### No Row Index — Rows Are Position-Only

- No `.iloc[]`, `.loc[]`, or `.iat[]` — use `.filter()`, `.top_k()`, or `.slice()`.
- Row ordering is the physical order from the source until you `.sort()`.
- `.group_by()` does NOT preserve original order.

### Namespaces for Specialized Operations

Polars uses namespaces on `pl.col()`:

```python
pl.col('name').str.contains('pattern')      # string methods
pl.col('date').dt.year()                     # datetime methods
pl.col('list_col').list.lengths()            # list methods
pl.col('arr').arr.mean()                     # array methods
pl.col('cat').cat.set_ordering('lexical')    # categorical methods
```

### Schema Handling — More Conservative Than pandas

```python
# polars does NOT silently coerce mixed types
# Specify schema upfront to avoid surprises

# Option 1: override specific columns
pl.read_csv("data.csv", schema_overrides={
    "zip_code": pl.Utf8,
    "id": pl.Utf8,
})

# Option 2: full schema declaration
pl.read_csv("data.csv", schema={
    "name": pl.Utf8,
    "age": pl.Int32,
    "salary": pl.Float64,
})
```

- Missing values in Int64 columns need `pl.Int64` (nullable integer type), not `pl.Int64` (which is non-nullable). Polars defaults to nullable types now, but be explicit if you see schema errors.
- Use `pl.Utf8` for strings (polars calls it Utf8, not `str` or `object`).

## Anti-Patterns

### 1. Forgetting `.collect()`

The most common polars mistake. If your variable prints as a DataFrame description instead of data, you forgot to `.collect()`.

```python
# BROWSER — prints query plan, not data
filtered = lazy_df.filter(pl.col('val') > 0)

# WORKS
filtered = lazy_df.filter(pl.col('val') > 0).collect()
```

### 2. Writing pandas Idioms in Polars

| pandas habit | polars replacement |
|---|---|
| `df[df.a > 0]` | `df.filter(pl.col('a') > 0)` |
| `df.assign(new=df.a + df.b)` | `df.with_columns((pl.col('a') + pl.col('b')).alias('new'))` |
| `df.groupby('cat')['val'].sum()` | `df.group_by('cat').agg(pl.col('val').sum())` |
| `df.rename(columns={'old': 'new'})` | `df.rename({'old': 'new'})` |
| `df.drop(columns=['x'])` | `df.drop('x')` |
| `df.isnull().sum()` | `df.null_count()` |
| `pd.concat([a, b])` | `pl.concat([a, b])` |
| `df.merge(other, on='id')` | `df.join(other, on='id')` |

### 3. Iterating Rows When You Shouldn't

```python
# AVOID — polars wasn't designed for this
for row in df.iter_rows():
    process(row)

# Better — use expressions
df.with_columns(
    pl.struct(['a', 'b']).map_elements(lambda s: complex_func(s['a'], s['b']),
                                       return_dtype=pl.Float64).alias('result')
)

# Best — restructure the problem so it's vectorized
```

`.iter_rows()` exists for debugging/output, not for data transformation.

### 4. Forgetting That `.unique()` Does Not Preserve Order

```python
# This does NOT give you first occurrences in original order
df.unique(subset=['user_id'])

# For first occurrence per group, use:
df.unique(subset=['user_id'], keep='first')
# But 'first' is defined by the row position, not any column value
```

### 5. Chain `.sort()` Before `.group_by()` for No Benefit

```python
# UNNECESSARY — group_by doesn't care about sort order
df.sort('region').group_by('region').agg(...)

# RIGHT
df.group_by('region').agg(...).sort('region')
```

### 6. Misusing `when().then().otherwise()` Outside Expressions

```python
# Correct
df.with_columns(
    pl.when(pl.col('val') > 0)
      .then(pl.lit('positive'))
      .otherwise(pl.lit('non-positive'))
      .alias('sign')
)
```

Note `pl.lit()` for literal values inside expressions.

## Null Handling

```python
# Check nulls per column
df.null_count()

# Drop rows with any null
df.drop_nulls()

# Drop rows with null in specific columns
df.drop_nulls(subset=['important_col'])

# Fill nulls
df.with_columns(
    pl.col('val').fill_null(0),
    pl.col('category').fill_null('unknown'),
    pl.col('num').fill_null(strategy='mean'),  # or 'zero', 'one', 'max', 'forward', 'backward'
)
```

## DateTime Operations

```python
# Parse string to date
df = df.with_columns(
    pl.col('date_str').str.strptime(pl.Date, format='%Y-%m-%d')
)

# Extract components
df.with_columns(
    pl.col('date').dt.year().alias('year'),
    pl.col('date').dt.month().alias('month'),
    pl.col('date').dt.quarter().alias('quarter'),
    pl.col('date').dt.weekday().alias('day_of_week'),
)

# Timeseries resampling (polars doesn't have .resample())
df.group_by_dynamic('date', every='1mo').agg(
    pl.col('sales').sum()
)
```

## Conversion to/from Other Formats

```python
# polars → pandas
df_pd = df_polars.to_pandas()

# polars → numpy
arr = df_polars.select(pl.col(['a', 'b'])).to_numpy()

# pandas → polars
df_pl = pl.from_pandas(df_pd)

# Arrow (zero-copy if possible)
table = df_polars.to_arrow()
df_pl = pl.from_arrow(table)
```

## Reading Performance Tips

| Source | Function | Notes |
|---|---|---|
| CSV | `pl.read_csv()` / `pl.scan_csv()` | Fast on its own; `.scan_csv()` for > 1GB |
| Parquet | `pl.read_parquet()` / `pl.scan_parquet()` | Use by default for repeated analysis |
| JSON | `pl.read_json()` | JSON Lines supported; `.ndjson` for newline-delimited |
| Excel | `pl.read_excel()` | Requires `xlsx2csv` or `openpyxl` |

For mixed file types in a directory: `pl.scan_csv('2025/*.csv')` or `pl.scan_parquet('sales/**/*.pq')`.

<!-- last-verified: 2026-06-26 polars-1.x -->