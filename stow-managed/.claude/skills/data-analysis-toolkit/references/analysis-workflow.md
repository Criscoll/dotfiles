# Analysis Workflow — Agent Patterns

When an LLM agent performs multi-step data analysis, structure each run as a verifiable pipeline rather than a single shot. This catches errors early and builds confidence.

**Default to polars for all workflow steps.** Convert to pandas only at the boundary of libraries that require it (scikit-learn, ydata-profiling).

## Standard Agent Analysis Loop

```
1. Inspect schema   → Column names, dtypes, row count, null counts
2. Understand data   → Summary stats, distributions, value counts on key columns
3. Clean             → Handle nulls, type coercion, outlier flagging
4. Transform         → Feature engineering, aggregation, filtering
5. Analyze / Model   → Statistical test, regression, classification, clustering
6. Visualize         → Plot results
7. Summarize         → Natural language findings with evidence
```

## Step 1: Schema Inspection First

Before any analysis, always inspect the data structure:

```python
# polars (default)
df.schema                                # column names + types
df.head(3)                               # sample rows
df.describe()                            # summary stats
df.null_count()                          # nulls per column
df.estimated_size('mb')                  # memory estimate

# DuckDB — best for files too large to load fully
duckdb.sql("DESCRIBE read_parquet('data.parquet')")
duckdb.sql("SELECT count(*) FROM read_csv_auto('data.csv')")
duckdb.sql("SUMMARIZE read_csv_auto('data.csv')")  # min/max/unique/null per column
```

## Step 2: Prove Intermediate Results

Every transformation should have a quick verification. Don't chain 5 steps and hope:

```python
# Bad — black box
result = (df
    .drop_nulls()
    .join(other, on='id')
    .group_by('cat')
    .agg(pl.col('amount').sum())
)

# Good — verified steps
df_no_null = df.drop_nulls(subset=['amount'])
print(f"Rows after null drop: {len(df_no_null)}")

df_joined = df_no_null.join(other, on='id', how='left')
matched = df_joined.filter(pl.col('val_right').is_not_null()).height
print(f"Join matches: {matched}")

result = (df_joined
    .group_by('cat')
    .agg(pl.col('amount').sum())
    .sort('cat')
)
print(result)
```

## Step 3: Verification Checks

At each stage, ask verification questions:

| Check | Query (polars) | What it catches |
|---|---|---|
| Row count sanity | `df.height vs expected` | Bad joins, over-filtering |
| Null spike | `df.null_count() vs schema` | Merge mismatches, bad transform |
| Type coercion | `df.dtypes` | Mixed-type columns, parse errors |
| Range bounds | `df.select(pl.col('val').describe())` | Outliers, unit errors |
| Uniqueness | `df.select(pl.col('id')).n_unique() vs df.height` | Duplicate rows |
| Aggregation sanity | `df.group_by('cat').agg(pl.col('val').sum())` | Double-counting from cross joins |

## Step 4: DuckDB + polars Hybrid Pattern

For complex analysis, use DuckDB for heavy lifting (joins, aggregations, window functions) and polars for post-processing:

```python
import duckdb, polars as pl

# DuckDB handles the heavy join/aggregate on files
summary = duckdb.sql("""
    SELECT
        c.region,
        DATE_TRUNC('month', o.order_date) as month,
        COUNT(DISTINCT o.customer_id) as customers,
        SUM(o.amount) as revenue,
        AVG(o.amount) as avg_order
    FROM read_parquet('orders/*.parquet') o
    JOIN read_csv_auto('customers.csv') c
        ON o.customer_id = c.id
    WHERE o.order_date >= '2025-01-01'
    GROUP BY c.region, DATE_TRUNC('month', o.order_date)
    ORDER BY c.region, month
""").pl()  # <-- returns polars DataFrame

# Polars for any further transformation or filtering
summary = summary.with_columns(
    (pl.col('revenue') / pl.col('customers')).alias('rpc')
)

# Convert to pandas only if plotly needs it (plotly accepts polars too)
px.line(summary.to_pandas(), x='month', y='revenue', color='region')
```

## Step 5: Reporting Findings

When summarizing results, pair each finding with its evidence:

```markdown
- **Finding:** Revenue dropped 12% in Q2 2025
- **Evidence:** `duckdb.sql("SELECT quarter, SUM(revenue) FROM read_parquet('data.parquet') WHERE ... GROUP BY quarter").pl()`
- **Segment breakdown:** Region EMEA dropped 18%, AMER dropped 5%
```

This makes results auditable and the agent's reasoning transparent.

## Avoid These Agent Anti-Patterns

- **Assuming clean data** — always check for nulls, outliers, and type issues before analysis.
- **Single-shot prompts** — asking "analyze this CSV and tell me everything" produces shallow output. Break into: schema → quality → EDA → hypothesis → test → conclusion.
- **Silent failures** — if a join produces 0 rows or `mean()` returns null, stop and report rather than continuing with corrupted data.
- **Over-reliance on defaults** — `RandomForestClassifier()` defaults may not suit small/imbalanced datasets. Set `class_weight='balanced'`, adjust `n_estimators`.
- **Multiple comparisons without correction** — running 20 t-tests on subgroups inflates Type I error. Use Bonferroni (`from statsmodels.stats.multitest import multipletests`).

<!-- last-verified: 2026-06-26 -->