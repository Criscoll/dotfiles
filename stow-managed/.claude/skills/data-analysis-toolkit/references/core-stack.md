# Core Data Stack — Detailed Comparison

## General Rule

**Reach for polars first. Revert to pandas only when blocked** (library incompatibility, legacy codebase that would cost more to migrate than to tolerate).

The sections below cover everything else in the stack. For polars and pandas details, load their dedicated reference files.

---

## DuckDB — Embedded SQL Engine

**When:** SQL-native workflows, querying files directly (no load), joining DataFrames from different sources, CTE-based analysis.

**Key features:**
- Queries CSV, Parquet, JSON *in place*: `FROM 'sales/*.parquet'` without loading entire dataset.
- `FROM read_csv_auto('file.csv')` auto-detects delimiter, header, types.
- Can directly query pandas or polars DataFrames by name in SQL.
- Supports window functions, recursive CTEs, UNNEST for arrays.
- `duckdb.sql(...)` returns a relation object — call `.df()` for pandas, `.pl()` for polars, `.fetchall()` for tuples.
- `duckdb.execute(...)` for side-effect statements (CREATE TABLE AS, COPY).

**Best pattern for LLM agents:** Use DuckDB as the intermediary — keep raw data in files, DuckDB queries subsets, pass results to polars/pandas for visualization or modeling:
```python
subset = duckdb.sql("""
    SELECT region, product, SUM(revenue) as total
    FROM read_parquet('sales/*.parquet')
    WHERE year = 2025
    GROUP BY region, product
""").pl()  # .pl() for polars, .df() for pandas
px.bar(subset.to_pandas(), x='region', y='total', color='product')
```

## ydata-profiling (formerly pandas-profiling)

**When:** Quick EDA report on a new dataset — distributions, missing values, correlations, alerts.

**Note:** ydata-profiling expects a **pandas** DataFrame. Convert from polars at the boundary:
```python
from ydata_profiling import ProfileReport
profile = ProfileReport(df_pandas, title="EDA Report", explorative=True)
profile.to_file("report.html")
```

- `explorative=True` enables more detailed univariate analysis and pairwise scatter plots.
- For large datasets, use `minimal=True` to skip heavy computations.
- Reports are self-contained HTML — can be shared via Slack, email, or saved as JSON.

## scipy.stats — Statistical Tests

| Test | Function | Use case |
|---|---|---|
| t-test (independent) | `stats.ttest_ind(a, b)` | Compare two groups' means |
| t-test (paired) | `stats.ttest_rel(a, b)` | Before/after on same subjects |
| Mann-Whitney U | `stats.mannwhitneyu(a, b)` | Non-parametric two-group comparison |
| Chi-square | `stats.chi2_contingency(table)` | Independence of categorical vars |
| ANOVA (one-way) | `stats.f_oneway(a, b, c)` | Compare three+ groups' means |
| Kolmogorov-Smirnov | `stats.ks_2samp(a, b)` | Compare two distributions |
| Shapiro-Wilk | `stats.shapiro(x)` | Test normality |
| Pearson correlation | `stats.pearsonr(x, y)` | Linear correlation + p-value |
| Spearman correlation | `stats.spearmanr(x, y)` | Monotonic correlation (robust) |

## scikit-learn — ML Toolkit

**Note:** scikit-learn expects numpy arrays or pandas DataFrames. Convert from polars at the boundary: `X_train = df_polars.select(pl.col(features)).to_numpy()`.

**Pipeline pattern (always use this for reproducibility):**
```python
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

preprocessor = ColumnTransformer([
    ('num', StandardScaler(), numeric_cols),
    ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_cols)
])

pipeline = Pipeline([
    ('prep', preprocessor),
    ('model', RandomForestClassifier(n_estimators=100, random_state=42))
])

pipeline.fit(X_train, y_train)
y_pred = pipeline.predict(X_test)
```

**Key model selection table:**

| Task | Go-to model | Fallback |
|---|---|---|
| Binary classification | `RandomForestClassifier` | `LogisticRegression`, `GradientBoostingClassifier` |
| Multi-class | `RandomForestClassifier` | `LogisticRegression(multi_class='multinomial')` |
| Regression | `GradientBoostingRegressor` | `RandomForestRegressor`, `Ridge` |
| Clustering | `KMeans` | `DBSCAN` (variable density) |
| Dimensionality reduction | `PCA` | `UMAP` (via umap-learn), `TSNE` (visualization only) |
| Anomaly detection | `IsolationForest` | `LocalOutlierFactor` |
| Feature importance | `RandomForest.feature_importances_` | `PermutationImportance` on any fitted model |

## Visualization Quick Reference

| Goal | Library | Function |
|---|---|---|
| Distribution (single var) | plotly | `px.histogram(df, x='col')` or `px.box(df, y='col')` |
| Distribution (by category) | plotly | `px.histogram(df, x='col', color='cat')` |
| Scatter (two vars) | plotly | `px.scatter(df, x='a', y='b', color='cat')` |
| Line (timeseries) | plotly | `px.line(df, x='date', y='val', color='series')` |
| Bar (aggregated) | plotly | `px.bar(df, x='cat', y='val')` |
| Correlation heatmap | seaborn | `sns.heatmap(df.corr(numeric_only=True), annot=True)` |
| Pairwise scatter grid | seaborn | `sns.pairplot(df, vars=['a','b','c'], hue='cat')` |

**For publication/static output:** prefer matplotlib/seaborn (vector PDF/SVG export).
**For interactive exploration:** prefer plotly (notebook, HTML export).
**Note:** plotly and seaborn accept both pandas and polars DataFrames. matplotlib needs numpy/pandas.

<!-- last-verified: 2026-06-26 -->