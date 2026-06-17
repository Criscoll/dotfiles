# Self-Hosted LLM Gateway: LiteLLM vs OpenRouter

Research conducted 2026-06-17. Sources: markaicode.com (cost breakdown), mpiv.ai (production agent comparison), merge.dev, truefoundry.com, evolink.ai, Reddit r/devops and r/LLMDevs.

## Current Setup

OpenRouter with pay-as-you-go (5.5% platform fee). Provider prices passed through at cost.

## The Core Question

Does self-hosting LiteLLM as a gateway materially decrease costs vs paying OpenRouter's 5.5% fee?

**Short answer: Not at personal-use volumes. Possibly worth it at $100+/month in API spend.**

## OpenRouter's Actual Pricing (verified May 2026)

- **Pay-as-you-go**: 5.5% platform fee on top of provider prices
- **BYOK**: 5% fee (or 1M free requests/month, then 5%)
- No markup on per-token provider pricing — model page mirrors Anthropic/OpenAI rates
- Prompt caching discounts are **not** passed through — you pay full price for repeated prompts
- Enterprise features (SSO, SOC-2, ZDR routing, EU region locking) are behind an unpriced Enterprise tier

## Cost Comparison Table

Assumes GPT-4o mini, 80/20 input/output split. OR markup at 20% (conservative estimate from sources; actual 5.5% would be even smaller difference).

| Volume | OpenRouter | LiteLLM (self-hosted) | Delta |
|---|---|---|---|
| <1M tokens/mo (hobby) | ~$88 | ~$50 + $0 infra (existing server) | OR cheaper (no infra cost) |
| 5M tokens/mo | ~$198 | ~$110 + $50 proxy | ~$38/mo savings |
| 10M tokens/mo (startup) | ~$885 | ~$465 + $50 proxy = ~$515 | ~$370/mo savings |
| 50M tokens/mo (scale-up) | ~$4,425 | ~$2,325 + $150 proxy = ~$2,475 | ~$1,950/mo savings |
| 100M+ tokens/mo (enterprise) | ~$8,850 | ~$4,650 + $200 proxy = ~$4,850 | ~$4,000/mo savings |

**Break-even point: ~5M tokens/month.** Below that, OpenRouter wins because you'd pay more for the proxy VPS than you save in markup.

## The Real Trade-Offs

### Why OpenRouter Wins at Low Volume
- No VPS to run ($5-15/mo basic, $50-200/mo reliable)
- No setup time (hours of config, testing, debugging)
- No maintenance burden (version upgrades, provider drift, monitoring)
- No on-call responsibility when proxy goes down
- Broad multi-provider model access behind one key instantly

### Why LiteLLM Wins at Scale
- No gateway markup on every token — savings compound linearly with volume
- Full control over routing, budgets, auth, governance
- Own observability pipeline (Langfuse, OTel, Postgres)
- No third-party gateway transit if compliance is a concern
- Open source — can fork if upstream stalls

### Hidden LiteLLM Costs
- You now run infrastructure in the critical path of every model call
- Postgres for keys/budgets, Redis for rate-limit coordination — all need maintenance
- "Data stays on your infrastructure" is **misleading** — prompts still go to the model provider (Anthropic/OpenAI). LiteLLM removes OpenRouter as a sub-processor, not the model provider.
- Engineer time: one real-world account reported "three late nights debugging a memory leak in the proxy container" for $88/mo savings
- Version pinning via PyPI, not GitHub tags (gotcha: LiteLLM requires Python <3.14)

### Hidden OpenRouter Costs
- Enterprise features behind unpriced tier
- Prompt caching not passed through — costs more for repeated queries
- App-attribution headers (`HTTP-Referer`, `X-OpenRouter-Title`) are a quiet lock-in vector
- No published uptime SLA percentage ("committed to being accretive to your uptime" — not a number)

## For Anthropic-Only Stacks (Claude Code, etc.)

MPIV.ai's direct quote:

> **"For Anthropic-only shops running Claude Code or production agents through Anthropic's API directly: adding a gateway layer adds latency, a failure mode, and a sub-processor for negligible benefit."**

If you're only using Claude models, skip both — use the Anthropic SDK directly with prompt caching and Workspaces for per-team budgeting.

## What Real People Say

> *"If you self host, then that pro [of OpenRouter] just evaporated."* — Reddit, r/openrouter

> *"LiteLLM is probably the closest thing to an open source OpenRouter replacement right now."* — Reddit, r/devops

> *"The arithmetic where OpenRouter wins is small-volume, multi-model workloads where standing up a proxy is more expensive than OpenRouter's platform fee."* — MPIV.ai production agent comparison, 2026

> *"I chose LiteLLM, but only because my workloads are heavy on one or two providers and I have someone who can operate a Python service."* — Same author

## Recommendation for Future Self

**Monitor your actual monthly token spend on OpenRouter.** If it crosses $100+/month (roughly 5M+ tokens), LiteLLM starts being worth evaluating. Until then, the 5.5% fee amounts to pocket change and the setup/ops cost isn't justified.

When you do cross that threshold, the playbook is:

1. Provision a small VPS ($5-15/mo DigitalOcean/Linode)
2. Run LiteLLM proxy in Docker behind the OpenAI-compatible endpoint
3. Point your coding agent at `OPENAI_BASE_URL=http://your-proxy:4000`
4. Keep paying providers directly — no gateway markup
5. Keep OpenRouter as a disaster-recovery fallback path

Alternatively, if you ever go **Anthropic-only**: skip LiteLLM entirely, use the Anthropic SDK directly, and pour the complexity budget into prompt caching instead.