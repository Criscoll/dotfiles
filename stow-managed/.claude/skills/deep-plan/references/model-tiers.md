## Effort tiers

Plans assign every dispatch step an **effort tier**, not a model ID. Model IDs
drift, get renamed, and differ per harness; the level of thinking a step
genuinely needs does not. The tier is a claim about the step, not a booking of
a specific model — the orchestrator decides at dispatch time which model or
sub-agent profile in its own harness satisfies that tier.

### Tier definitions

- **Lightweight** — fully specified mechanical edits with no design choice
  left. The brief spells out the literal change — the exact text, value, or
  code to write — so the work is transcription plus running the check. A step
  described in prose ("add a flag that does X") is not Lightweight even when
  it's small; it needs Moderate Thinking at minimum.
- **Moderate Thinking** — the default tier. Follows existing patterns across a
  few files; some judgment but no novel design.
- **Deep Thinking** — subtle algorithmic, concurrency, or security logic;
  steps where a mistake would still pass tests; debugging-heavy steps where
  the fix isn't obvious from the brief alone.

**Rule:** pick the lowest tier that can do the step from its brief alone. If
in doubt, pick the higher tier for steps that produce a contract another item
consumes — a wrong contract shape is expensive to unwind downstream.

**Cost is turns, not token price.** A step's real cost is how many turns the
sub-agent takes to finish it, and the cheapest models routinely take two to
three times as many turns on anything multi-step — re-reading files, retrying
edits, misreading the brief — which costs more overall than a mid-tier model
that finishes in one pass. So "lowest tier that can do it" means lowest tier
that can do it *without flailing*: reserve Lightweight for literal edits, and
treat a group whose brief has any prose instruction as Moderate Thinking or
above.

### Choosing a model for each tier, at dispatch time

Don't hardcode a tier→model mapping into a plan — read it off whatever the
executing harness currently offers, reasoning about relative capability:

- **Deep Thinking** → the harness's most capable / frontier-reasoning model
  or sub-agent profile currently available. If the harness exposes an
  extended-thinking or reasoning-effort knob independent of model choice,
  prefer raising that knob over switching models when both are available.
- **Moderate Thinking** → the harness's default general-purpose model.
- **Lightweight** → the harness's fastest/cheapest model still capable of
  mechanical edits.

Examples of what this looks like in two harnesses, illustrative only (do not
treat these as a lookup table to follow blindly — verify against what's
actually available before dispatching):

- **Claude Code** (`Agent` tool, `model` param, `general-purpose` sub-agent):
  a frontier model for Deep Thinking, the default model for Moderate
  Thinking, a small/fast model for Lightweight.
- **pi** (`subagent` tool, `implementer` agent, `provider`/`model`): the
  strongest reasoning model configured for Deep Thinking, a balanced
  mid-tier model for Moderate Thinking, a fast/cheap model for Lightweight.

If you want a durable anchor instead of re-deriving this each run, log which
concrete model you mapped to each tier in `EXECUTION-LOG.md` the first time
you dispatch at that tier in a given execution run — that's a per-run record,
not a fact about the skill, so it never goes stale.

### Fallback for other harnesses

If the executing harness has no sub-agent mechanism, or none matching the
tier's intent, run the step inline on whatever model is active and log in
EXECUTION-LOG.md that tiers weren't honoured for that step. Otherwise use the
nearest equivalent sub-agent and model available in that harness.
