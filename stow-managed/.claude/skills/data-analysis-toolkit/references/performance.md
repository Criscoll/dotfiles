# Performance — Large Dataset Strategies

**Default to polars.** DuckDB for SQL-shaped analysis. Reserve pandas for the "small and already in pandas" case.

## Dataset Size → Strategy

| Size | Approach | Tools |
|---|---|---|
| < 1GB (fits comfortably) | In-memory polars | `pl.read_csv()`, standard expressions |
| 1–10GB (memory-pressure) | Column pruning + lazy streaming | `pl.scan_csv()`, `.filter()` before `.collect()` |
| 10–100GB (won't fit) | Out-of-core / file-based | DuckDB on files, polars lazy streaming |
| > 100GB | Distributed / partitioned | PySpark, DuckDB on partitioned Parquet |

## Column Pruning — Always Do First

Before loading a dataset, know which columns you need and exclude the rest. This is the **single highest-impact optimization** — most people skip it:

```python
# polars — select projection before collect (lazy pushes to file reader)
lazy = pl.scan_csv("huge.csv")
query = lazy.select(['id', 'date', 'amount', 'region'])
df = query.collect()

# DuckDB — query subset of columns from file directly (best for ad-hoc)
subset = duckdb.sql("""
    SELECT id, date, amount
    FROM read_csv_auto('huge.csv')
    WHERE amount > 100
""").pl()
```

## Streaming with polars Lazy API

For operations that must scan a large dataset, polars lazy streaming handles out-of-core processing automatically:

```python
lazy = pl.scan_csv("huge.csv")

result = (lazy
    .filter(pl.col('date') >= '2025-01-01')
    .group_by('region')
    .agg(pl.col('amount').sum())
    .sort('region')
).collect(streaming=True)  # streaming=True processes in batches
```

`streaming=True` tells polars to process in batches, spilling to disk if needed. Without it, `.collect()` loads all data into memory.

## DuckDB — Best for Large File Analysis

DuckDB operates on files directly without loading them entirely:

```python
# Query parquet files in place
duckdb.sql("""
    SELECT region, SUM(amount) as total
    FROM read_parquet('sales/*.parquet')
    WHERE date >= '2025-01-01'
    GROUP BY region
""").pl()

# Can also query multiple CSVs with pattern
duckdb.sql("""
    SELECT count(*) FROM read_csv_auto('data/*.csv', union_by_name=True)
""")
```

DuckDB can handle datasets larger than RAM because it spills to disk and uses multi-threaded processing. It's the simplest option for SQL-shaped analysis on large files — no lazy API to manage.

## When to Use Parquet Instead of CSV

| Factor | CSV | Parquet |
|---|---|---|
| Read speed (subset of columns) | Must read all columns | Only reads requested columns |
| File size | Uncompressed, large | Columnar compression, 5-10x smaller |
| Schema | No schema (inferred) | Self-describing (types stored) |
| Complex types | Strings only | Nested, arrays, structs |
| Append-friendly | Easy (bad for big files) | Hard (write new files) |

For any analysis that runs more than once, convert source CSV to Parquet: `df.write_parquet('data.parquet')`.

## Memory Monitoring

```python
import psutil
print(f"Memory: {psutil.virtual_memory().percent}% used")
print(f"Free: {psutil.virtual_memory().available / 1e9:.1f} GB")

# polars — memory estimate
print(f"Estimated size: {df.estimated_size('mb')} MB")

# polars — peek at query plan
print(lazy_q.explain())  # shows optimization plan, helps estimate
```

## When NOT to Optimize

- If the dataset fits in memory and runs in < 10s and the analysis runs once — just use polars with `pl.read_csv()` (eager). Don't over-engineer with lazy or DuckDB.
- Multi-threading (`n_jobs=-1` in scikit-learn) can cause OOM on large datasets — reduce `n_jobs` or use `preferred_datasets` to limit in-memory data.
- If the dataset is small (<100k rows), any tool works fine — optimization is irrelevant.

<!-- last-verified: 2026-06-26 -->