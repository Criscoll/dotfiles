# Visualization — Library Selection and Chart Choice

## Library Decision Matrix

| Factor | plotly | matplotlib + seaborn | altair |
|---|---|---|---|
| Interactive | Yes (zoom, hover, pan) | Limited (widgets) | Yes (Vega-Lite) |
| Static export | `fig.write_image()` needs kaleido | `plt.savefig('fig.pdf')` native | `chart.save('chart.png')` |
| Publication quality | Good (SVG export) | Excellent (PDF/SVG/TiKZ) | Good (SVG) |
| Large data (>100k points) | Slow — use `sample()` or `datashader` | Slower — use rasterization | Good — Vega-Lite aggregates |
| Notebook integration | Excellent | Excellent | Excellent |
| Slack/email | Static image | Static image | Static image or Vega-embed |
| Dashboard export | `fig.write_html('file.html')` | mpld3 or manual | `chart.to_html()` |
| Ease of use | Very easy (px) | Medium (pyplot OO) | Medium (declarative) |

## Chart Selection Guide

| Data relationship | Chart type | plotly | seaborn |
|---|---|---|---|
| One numeric variable | Histogram / Box | `px.histogram(df, x='val')` | `sns.histplot(df, x='val')` |
| One numeric, one categorical | Bar / Box | `px.box(df, x='cat', y='val')` | `sns.boxplot(df, x='cat', y='val')` |
| Two numeric | Scatter | `px.scatter(df, x='a', y='b')` | `sns.scatterplot(df, x='a', y='b')` |
| Time series | Line | `px.line(df, x='date', y='val')` | `sns.lineplot(df, x='date', y='val')` |
| Category → category | Heatmap | `px.imshow(ct, text_auto=True)` | `sns.heatmap(ct, annot=True)` |
| Continuous color mapping | Scatter + color | `px.scatter(df, x='a', y='b', color='c')` | `sns.scatterplot(df, x='a', y='b', hue='c')` |
| Subplots / facets | Facet | `px.bar(df, x='cat', y='val', facet_col='group')` | `sns.catplot(df, x='cat', y='val', col='group')` |

## Anti-Patterns

**plotly:**
- `fig.show()` in scripts without a display raises — use `fig.write_html()` or `fig.write_image()` for non-interactive contexts.
- Using plotly on >100k points without sampling: `df.sample(n=10000)` before plotting.
- Forgetting to set `category_orders` — categorical axes order by first occurrence, not naturally.
- `update_layout(template='plotly_dark')` for professional look in automated reports.

**matplotlib:**
- Creating figures in a script with `plt.show()` blocks execution — use `fig.savefig()` then `plt.close(fig)` to avoid memory leaks.
- Calling `plt.` functions (state machine) instead of explicit `fig, ax = plt.subplots()` — the OO API is safer and reusable.
- Default figure size is small (6.4x4.8) — set `figsize=(10, 6)` for readable output.
- `sns.set_theme(style='whitegrid')` once at the top for consistent style.

## Output Format Decision

| Destination | Use | Example |
|---|---|---|
| Jupyter notebook | Inline display | `fig.show()` or `%matplotlib inline` |
| HTML report / dashboard | plotly HTML | `fig.write_html('report.html')` |
| Paper / publication | matplotlib PDF/SVG | `fig.savefig('fig1.pdf', bbox_inches='tight')` |
| Slack / chat message | Static PNG | `fig.write_image('chart.png', scale=2)` |
| Markdown/IPython | Markdown + alt-text | Embed as `![chart](chart.png)` |
| Web dashboard (interactive) | plotly + Dash | `fig.to_html(include_plotlyjs='cdn')` |

<!-- last-verified: 2026-06-26 -->
