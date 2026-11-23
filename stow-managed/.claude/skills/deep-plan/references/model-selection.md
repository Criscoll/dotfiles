## Model selection

Execution runs on **one model: whichever the user starts the session on.** Plans
don't name models, tiers, or sub-agent profiles — IDs drift and differ per
harness, and a cleared execution session has no way to switch itself anyway. The
user picks a capable worker model and runs `EXECUTE.md`; that is the default for
every step.

### The `Needs strong model` flag

A step is flagged only when a worker model would plausibly get it wrong *without
anything failing*:

- subtle algorithmic, concurrency, or security logic;
- a step whose mistake would still pass its `Done when:` and the item gate;
- debugging-heavy work where the fix isn't evident from the brief;
- a step that produces a contract other items consume, when the shape is
  non-obvious (a wrong contract is expensive to unwind downstream).

Write it as one line under the step heading: `Needs strong model: <why>`. No
line means worker. Don't flag a step because it is large or tedious — a worker
handles those; flag it because it is *hard to get right and hard to notice when
wrong*.

**The planner sets the flag, at plan time.** A model that is out of its depth
often can't tell, so runtime self-assessment is not the mechanism. The runtime
backstop is the existing failure flow: a gate that won't pass writes
`FAILURE.md` and halts, and the re-plan can flag the step.

**Flag sparingly.** Each flagged group costs a manual stop and a model switch
for the user. Where dependency order allows, keep flagged steps contiguous (and
ideally at an item boundary) so one handoff covers them.

### What a flag does at execution

The executor halts before the first flagged group, logs a `HANDOFF` entry, and
prints a paste-ready prompt for the user to run in a fresh session on a strong
model. That session implements only that group, then stops; the user switches
back to the worker model and resumes. The protocol is in `EXECUTE.md`; resume
position comes from the ticked checkboxes, so no extra state is needed.
