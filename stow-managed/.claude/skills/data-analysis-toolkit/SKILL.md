---
name: data-analysis-toolkit
description: >-
  Apply the data analysis Python toolkit (pandas, polars, DuckDB, plotly, ydata-profiling,
  scipy, scikit-learn) — covers tool selection, anti-patterns, import paths, and workflow
  patterns for agent-driven analysis. Auto-invoke BEFORE writing any data analysis code,
  processing a CSV/Parquet/Excel/JSON file, generating a visualization, or running
  statistical/ML analysis. Not for general Python scripting without data, not for
  infrastructure or DevOps. Trigger phrases: "data analysis", "pandas", "polars",
  "dataframe", "csv", "parquet", "eda", "data profiling", "analysis", "visualization",
  "plot", "statistics", "regression", "classification", "scikit-learn", "duckdb",
  "ydata-profiling", "plotly", "matplotlib", "seaborn", "data cleaning", "data
  wrangling", "feature engineering", "dataset", "exploratory", "read_csv",
  "DataFrame", ".csv file", ".parquet file", ".xlsx", "NL2SQL", "text-to-sql",
  "histogram", "scatter plot", "correlation", "missing values", "outliers".
disable-model-invocation: false
---

You are performing data analysis with Python. Apply the following rules and load reference files as directed.

## Polars First — pandas Only When Required

**Default to polars for all new analysis.** Reach for pandas only when:
- The codebase already uses pandas (don't mix DataFrame types in one project)
- A library requires pandas DataFrames as input/output
- You need ecosystem tools (ydata-profiling expects pandas; scikit-learn accepts pandas but not polars)
- Quick one-off EDA on a small file where setup time matters more than performance

When you do use pandas, keep it contained — convert at the boundary, don't let it sprawl.

## Core Tool Selection — Which One When

| Situation | Tool | Why |
|---|---|---|
| All-purpose DataFrame wrangling, new code | **polars** | Fast, memory-efficient, lazy by default, consistent API |
| Legacy codebase or library requires it | **pandas** | Only reach for this when polars won't work |
| Tabular data > 1GB | **polars** or **DuckDB** | 5-10x faster than pandas, streaming, memory-efficient |
| SQL queries on CSV/Parquet without loading fully | **DuckDB** | `FROM read_csv_auto('file.csv')` — queries files in place |
| Quick EDA report | **ydata-profiling** | Single-line report: `ProfileReport(df).to_file("report.html")` (expects pandas) |
| Interactive visualizations | **plotly** | Hover tooltips, zoom, pan — renders in notebooks/HTML |
| Publication-static visualizations | **matplotlib + seaborn** | Fine-grained control, journal-ready output |
| Statistical tests / distributions | **scipy.stats** | t-tests, chi-square, ANOVA, KS, normality tests |
| Regression / classification / clustering | **scikit-learn** | Consistent API, cross-validation, pipelines (prefers pandas/numpy) |

## Anti-Patterns to Avoid

| Avoid | Instead use | Why |
|---|---|---|
| `for row in df.iter_rows()` (polars) | Vectorized expressions: `df.with_columns(...)` | Polars is built for column-wise ops; row iteration kills all performance gains |
| Thinking polars has a row index | `row_number()` or explicit sort ordering | Polars has no index — ordering is positional, not a label. `.filter()` does not reset, `.unique()` does not preserve order |
| Chaining `.filter()` before `.group_by()` / `.sort()` | Always sort or aggregate *after* filtering | Filtering is cheap; sorting/grouping large intermediate results wastes memory |
| Forgetting `.collect()` in polars lazy mode | `.collect()` at the end of the lazy chain | Polars is lazy by default — nothing runs until `.collect()` triggers execution |
| `pd.read_csv()` without `dtype` (pandas) | `pd.read_csv('file.csv', dtype={'col': str})` | Auto-inference silently converts ZIP codes to int, etc. |
| `.apply(lambda x: ...)` on large column (pandas) | Built-in vectorized op (`df['col'].str.contains()`) | `.apply()` bypasses C-optimized vector paths |
| `pd.concat([dfs])` in a loop (pandas) | Collect all dfs in a list, single `pd.concat()` at end | Append-in-loop creates many copies |
| Running full dataset in pandas | DuckDB query on the file directly: `FROM 'data.parquet' WHERE ...` | Avoids loading irrelevant columns/rows into memory |

## Key Import Paths (models hallucinate these)

```python
import polars as pl
import pandas as pd                            # only when polars won't work
import duckdb
import plotly.express as px
import plotly.graph_objects as go
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from ydata_profiling import ProfileReport       # expects pandas DataFrame
```

## DuckDB Querying DataFrames Directly

DuckDB can query both pandas and polars DataFrames without copying — use this for SQL-on-DataFrame:

```python
import polars as pl, duckdb

df = pl.read_csv("sales.csv")
result = duckdb.sql("""
    SELECT region, SUM(amount) as total
    FROM df
    WHERE date >= '2025-01-01'
    GROUP BY region
    ORDER BY total DESC
""").pl()  # returns polars DataFrame — use .df() for pandas
```

## Load Reference Files When Relevant

Read these using `cat "$CLAUDE_SKILL_DIR/references/<file>"`. Do not guess their contents.

- **references/polars.md** — load when: writing new polars expressions, debugging lazy vs eager issues, setting up polars schema or null handling, or any polars-specific question.
- **references/pandas.md** — load when: forced to use pandas (legacy code, library requirement), debugging pandas-specific gotchas (chained indexing, MultiIndex, inplace deprecation).
- **references/core-stack.md** — load when: choosing between pandas/polars/DuckDB, needing detailed API differences, or first-time setup of an analysis environment.
- **references/analysis-workflow.md** — load when: planning a multi-step analysis, building an agent loop for data QA, or designing a verification/checking strategy.
- **references/visualization.md** — load when: picking a chart type, needing plotly vs matplotlib/seaborn guidance, or rendering for a specific output format (HTML, static, notebook).
- **references/performance.md** — load when: dataset exceeds available memory, operations are too slow, or deciding on chunking/parallelization/out-of-core strategies.

<!-- last-verified: 2026-06-26 pandas-2.x polars-1.x duckdb-1.x scikit-learn-1.x -->