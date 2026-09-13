## Model tiers

Batch-mode plans assign every dispatch step a **tier**, not a model ID. Model IDs
drift and differ per harness; tiers stay stable across the roadmap's lifetime.

### Tier definitions

- **`fast`** — fully specified mechanical edits with no design choice left. The
  step's brief already names the exact change; the implementer just makes it.
- **`standard`** — the default tier. Follows existing patterns across a few
  files; some judgment but no novel design.
- **`frontier`** — subtle algorithmic, concurrency, or security logic; steps
  where a mistake would still pass tests; debugging-heavy steps where the fix
  isn't obvious from the brief alone.

**Rule:** pick the lowest tier that can do the step from its brief alone. If in
doubt, pick the higher tier for steps that produce a contract another item
consumes — a wrong contract shape is expensive to unwind downstream.

### Lookup table

| Tier | Claude Code (Agent tool `model`, `general-purpose`) | pi (`subagent`, agent `implementer`, `provider` / `model`) |
|---|---|---|
| frontier | `opus` | `openrouter` / `moonshotai/kimi-k2.6` |
| standard | `sonnet` | `openrouter` / `deepseek/deepseek-v4-pro` |
| fast | `haiku` | `openrouter` / `deepseek/deepseek-v4-flash` |

### Fallback for other harnesses

If the executing harness has no sub-agent mechanism, or none matching the
tier's intent, run the step inline on whatever model is active and log in
EXECUTION-LOG.md that tiers weren't honoured for that step. Otherwise use the
nearest equivalent sub-agent and model available in that harness.
