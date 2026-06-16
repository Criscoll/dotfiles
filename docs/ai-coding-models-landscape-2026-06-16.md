# AI Coding Model Landscape — 2026-06-16

> Snapshot of the non-Anthropic coding model landscape as of June 2026.
> Models and benchmarks evolve fast — treat anything here with a ~3-month horizon.

## Session Goal

Identify cost-effective alternatives to Anthropic models (Claude Opus 4.8, Fable 5) for coding workflows. Specifically:
- Which models are best for **complex planning / problem solving**
- Which models are best for **code editing / spec execution**
- At what price points

## Key Insight: Plan vs Execute Split

No single model dominates both planning and execution affordably. The most cost-effective setup routes by task type:
- **Plan** with a reasoning-heavy model
- **Execute** with a cheap, fast editing model

---

## Tier 1: Value Workhorse (Execution)

### DeepSeek V4 Flash
- **Price**: $0.14/M input, $0.28/M output; cache hits at $0.0028/M
- **Context**: 1M tokens / 384K max output
- **SWE-bench Verified**: 79.0%
- **LiveCodeBench (Max)**: 91.6%
- **License**: MIT
- **Position**: The cheapest competent coding model available. Best for high-volume code editing, linting, test generation, batch refactors, CI bots. Use in non-thinking mode for simple edits.
- **Caveat**: Token-hungry (~240M output for the AA benchmark suite). The one-shot coding test produced a non-editable editor UI — may need iteration on complex multi-file generation.

---

## Tier 2: Planning / Complex Reasoning

### DeepSeek V4 Pro (best value planner)
- **Price**: $0.435/M input, $0.87/M output; cache hits at $0.003625/M
- **Context**: 1M tokens / 384K output
- **SWE-bench Verified**: 80.6%
- **LiveCodeBench**: **93.5%** — #1 of all models including closed APIs
- **GDPval-AA** (agentic real-world): **1554** — highest among open weights
- **License**: MIT
- **Position**: Same API and family as Flash. Permanent pricing (May 2026) makes it ~3x Flash but ~2x cheaper than Kimi. Best default planner for most allocation.
- **Caveat**: More verbose than Kimi. On a high-stakes reasoning test, produced creative but occasionally "dramatic" plans.

### Kimi K2.6 (best open-weight reasoning)
- **Price**: $0.95/M input, $4.00/M output; 83% cache discount on input
- **Context**: 256K tokens
- **AA Intelligence Index**: **54** — highest among all open-weight models
- **SWE-bench Verified**: 80.2%
- **SWE-bench Pro**: 58.6% (vendor claims #1 among open weights)
- **License**: Modified MIT
- **Position**: Best for ambiguous architectural decisions, novel problem-solving, crisis reasoning. Native 300-sub-agent swarm coordination, 12-hour autonomous runs. In real-world stress-test, produced the most thorough logistical plans.
- **Caveat**: Most expensive of the open-weight tier. Modified MIT license may flag lawyers (attribution clause at very large scale). No vision capabilities.

### Gemini 3.1 Pro (novel problem specialist)
- **Price**: $2.00/M input, $12-15/M output
- **Context**: 1M tokens
- **ARC-AGI-2**: **77.1%** — crushes GPT-5.5's 52.9%
- **GPQA Diamond**: **94.3%** — highest of all models tested
- **SWE-bench Verified**: 80.6%
- **Position**: Best when problems are genuinely novel (not pattern recall). Native multimodal. Good for research-style planning where the problem space is poorly defined.
- **Caveat**: Slow latency. Only 65K max output (vs GPT-5.5's 128K). On structured reasoning trails GPT-5.5.

---

## Tier 3: Other Notable Open Weights

### MiniMax M3 (released 2026-06-01)
- **Price**: $0.30-0.60/M input, $1.20-2.40/M output
- **Context**: 1M tokens
- **SWE-bench Verified**: 80.5%
- **SWE-bench Pro**: 59.0% — beats GPT-5.5 and Gemini 3.1 Pro
- **Position**: First open-weight model with frontier coding + 1M context + native multimodality. Weights pending community release (expected ~10 days post-API launch). Strong emerging option.

### GLM 5.1 / 5.2
- **Price**: 5.1 API at $1.40/$4.40; 5.2 Coding Plan ~$10-80/mo (weights TBD)
- **Context**: 5.1 at 200K; **5.2 at 1M** (launched 2026-06-13)
- **SWE-bench Pro (5.1)**: 58.4% (SOTA at release)
- **Code Arena Elo**: 1530 — only independently confirmed coding Elo among these
- **License**: MIT
- **Position**: Best for long-horizon agentic engineering. Strong on tool-iteration over thousands of calls. 5.2 added 1M context but has no published benchmarks as of this date.
- **Caveat**: Failed one-shot real-world coding test. Z.ai is on the US BIS Entity List.

### Qwen 3.6 Max / Qwen3.6-27B
- **Price**: Max at ~$0.40/$2.40; 27B dense self-hostable
- **Context**: 256K-1M depending on variant
- **SWE-bench Verified**: 77.2% (27B), higher for Max
- **Position**: Strong operational / domain-aware reasoning (e.g., journalism-safety resources in stress-test). Qwen3.6-27B fits a single 24GB GPU — best consumer-hardware option for local planning.

---

## Tier 4: Proprietary Heavyweights (Cost Tolerated on Key Tasks)

### GPT-5.5
- **Price**: $5/M input, $30/M output (standard), $10/$45 (long context)
- **Context**: 1M tokens / 128K output
- **Expert-SWE**: 73.1%
- **Terminal-Bench 2.0**: 82.7%
- **Position**: Best structured reasoning (multi-step math, logic, layered instructions). Fastest latency among flagships. Best for the 10% of tasks where plan quality is critical and budget is secondary.
- **Caveat**: 52.9% ARC-AGI-2 — weaker than Gemini 3.1 Pro on truly novel problems. 2-2.5x more expensive than Gemini.

---

## Recommended Routing

```
Planning / Architecture / Novel Problems
  ├─ DeepSeek V4 Pro  ← default planner ($0.87/M output, 1M ctx)
  ├─ Kimi K2.6        ← when ambiguous / architecturally intense ($4/M)
  └─ Gemini 3.1 Pro   ← when problem is genuinely novel ($12-15/M)

Code Editing / Spec Execution
  └─ DeepSeek V4 Flash ← default executor ($0.28/M output, 1M ctx)
     └─ ↑ MiniMax M3, DeepSeek V4 Pro, or Kimi K2.6 for the ~10-20%
         of editing tasks that Flash cannot handle
```

Using this split, a team running 80% of volume through Flash and reserving Pro/MiniMax for the other 20% would spend roughly 5-15x less than an all-Claude or all-GPT workflow.

## Important Gotchas (June 2026)

- **DeepSeek legacy aliases** (`deepseek-chat`, `deepseek-reasoner`) retire **July 24, 2026**. Migrate to `deepseek-v4-flash` / `deepseek-v4-pro`.
- **No standard Jinja template for V4** — use the encoding scripts from the model's HuggingFace repo. Generic chat templates silently produce malformed prompts.
- **MiniMax M3 weights** not yet available as of this date (expected ~10 days post-API launch).
- **GLM 5.2** launched June 13 with 1M context but **no published benchmarks**.
- **Claude Fable 5 suspended** since June 12 due to US export-control directive (irrelevant given constraints, but explains why its benchmark scores can't be relied on).

## Price Comparison at a Glance

| Model | Input $/M | Output $/M | SWE-bench Verified | Context |
|---|---|---|---|---|
| DeepSeek V4 Flash | $0.14 | $0.28 | 79.0% | 1M |
| DeepSeek V4 Pro | $0.435 | $0.87 | 80.6% | 1M |
| MiniMax M3 | $0.30 | $1.20 | 80.5% | 1M |
| Qwen 3.6 Plus | $0.40 | $2.40 | ~80% | 1M |
| GLM 5.1 | $1.40 | $4.40 | ~78% | 200K |
| Kimi K2.6 | $0.95 | $4.00 | 80.2% | 256K |
| Gemini 3.5 Flash | $1.50 | $9.00 | ~79% | 1M |
| Gemini 3.1 Pro | $2.00 | $12-15 | 80.6% | 1M |
| GPT-5.5 | $5.00 | $30.00 | ~82% (est.) | 1M |
| Claude Opus 4.8 | $5.00 | $25.00 | 88.6% | 1M |
| Claude Fable 5 | $10.00 | $50.00 | 95.0% | 1M |

## Sources Consulted

- morphllm.com — cost-per-point analysis, SWE-bench Pro leaderboard
- codersera.com — Kimi K2.6 vs DeepSeek V4 vs GLM-5.1 head-to-head; GLM 5.2 launch notes
- kilo.ai — open-weights model rankings and benchmarks
- edenai.co — GPT-5.5 vs Gemini 3.1 Pro reasoning comparison
- dailytopai.com — 6 Chinese models real-world practical test
- global-apis.com — DeepSeek vs Qwen vs Kimi vs GLM pricing and use-case matrix
- benchlm.ai — model comparison (DeepSeek V4 Pro vs Kimi K2.6), Gemini vs GPT-5.5
- aicybr.com — DeepSeek V4 architecture, pricing, deployment guidance
- vendor API docs (deepseek.com, minimax.com, kimi.moonshot.cn, z.ai, openai.com, google.ai)
- Reddit /r/opencodeCLI, /r/DeepSeek community impressions

## Next Review Trigger

Re-evaluate when:
- GLM 5.2 benchmarks publish
- MiniMax M3 open weights release
- Any model wins SWE-bench Verified >85% at < $2/M output
- DeepSeek V5 or Kimi K2.7 ships
- GLM 5.2 standalone per-token API is available
