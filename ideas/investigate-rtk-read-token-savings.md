# Investigate `rtk read` Token Savings

## Context

`rtk` (v0.42.4) is a CLI proxy that wraps commands to reduce token usage before
output reaches an LLM. The `rtk read` subcommand replaces `cat <file>` when the
rtk pi extension (`~/.pi/agent/extensions/rtk.ts`) intercepts bash tool calls.

## The Puzzle

`rtk gain` reports:

| Command | Calls | Saved | Avg% |
|---|---|---|---|
| `rtk read` | 107 | 44.7K | **14.9%** |
| `rtk grep` | 53 | 18.1K | 25.0% |
| `rtk git diff` | 12 | 11.9K | 22.9% |

But `rtk read` with its default `--level none` filter is a **pure passthrough**:

```
$ rtk read -v -v <file> 2>&1 | head -1
Reading: <file> (filter: none)
Lines: 408 -> 408 (0.0% reduction)
```

Every file we tested (markdown, TypeScript, JSON, shell scripts) produces
byte-identical output between `rtk read --level none` and `cat`.

Yet the `history.db` (SQLite at `~/.local/share/rtk/history.db`) shows some
reads with **90%+ token savings**:

| File | Input tokens | Output tokens | Save% |
|---|---|---|---|
| PLAN.md | 4331 | 24 | **99.4%** |
| hook-analytics (shell) | 2896 | 23 | **99.2%** |
| subagent/index.ts | 8756 | 292 | **96.7%** |
| CLAUDE.md | 5963 | 551 | **90.8%** |

And the same files also appear with identical input sizes and 0% savings:

```
CLAUDE.md      5963 in,  551 out  (90.8%)  ← same file, same input size
CLAUDE.md      5963 in, 5963 out  (0.0%)   ← multiple zero-savings entries
subagent.ts    8756 in,  292 out  (96.7%)
subagent.ts    8756 in, 8756 out  (0.0%)   ← two zero-savings entries
```

This **cannot** be explained by content changes — input token sizes match.

## What This Means

The user's instinct was correct: the 14.9% average savings for `rtk read` is
misleading. The reads pass through unchanged (0% savings) for the vast majority
of cases. The ~15% average is pulled upward by a handful of reads that somehow
recorded 90%+ savings despite identical output.

## Hypotheses for the Discrepancy

1. **rtk version change**: An earlier version of rtk applied filtering in the
   `read` subcommand (e.g., stripping comments, truncating long lines) that was
   removed or made opt-in by v0.42.4. The database entries with 90%+ savings
   were recorded under that earlier version.

2. **Token counting methodology**: The token savings might reflect a change in
   how rtk *counts* tokens (e.g., switching from a simple byte/4 estimate to an
   actual tokenizer, or vice versa) between runs. The raw bytes are identical
   but the reported token count differs.

3. **Flag-based filtering**: The pi rtk extension or agent invoked `rtk read`
   with explicit flags (`--ultra-compact`, `--level minimal/aggressive`,
   `--max-lines`) for some reads but not others. The `history.db` stores the
   original `cat <file>` command and the rtk subcommand (`rtk read`), but
   doesn't record **flags**. If those flags cause the savings, the data would
   look like this — same command, different outcomes.

4. **Output truncation at the harness level**: The LLM harness (Claude Code or
   pi) may truncate output that exceeds a limit. If rtk's token counter measures
   the full file but the harness truncates before feeding to the LLM, the
   "savings" could be a measurement artifact.

## What to Investigate

### 1. Check rtk version history

Does the `rtk read` subcommand have a history of more aggressive defaults?
Check:
- The rtk binary's own `--version` output in the tee logs
- Whether `rtk read` at `--level minimal` or `--level aggressive` produces
  different output from `--level none`
- Whether earlier rtk releases had different default filter behavior

### 2. Replay the exact reads with flags to find the savings

The database timestamps show these reads happened on June 18-19, 2026. Test
`rtk read` with each flag combination to see which one produces the ~90%
reduction reported for files like CLAUDE.md (5963 in → 551 out):

```
rtk read --ultra-compact <file>        ← test
rtk read --level minimal <file>        ← test
rtk read --level aggressive <file>     ← test
rtk read --max-lines <N> <file>        ← test various N
```

### 3. Verify token counting

If no flag combination reproduces the reported savings, the token counting
methodology itself may have changed. Compare:
- rtk's reported token count vs. actual byte/4 estimate
- Whether the `output_tokens` field might represent something other than
  rtk's actual output length (e.g., an LLM response estimate)
- Whether the pi harness truncates output and that truncation is what rtk
  records as "savings"

### 4. Look at tee logs from the high-savings era

The `~/.local/share/rtk/tee/` directory only contains `tsc` and `lint` logs
from that period — no `read` logs. This might mean tee is configured with
`mode = "failures"` (only logs failures). If the reads succeeded normally,
their full output wouldn't be saved. But check whether the tee config could
be changed to capture read output for verification.

### 5. Check the rtk Rust source

If rtk is open-source, check `src/commands/read.rs` (or similar) for the
current and historical filter implementation. Look for:
- Content-type detection logic
- Filter level implementations
- How `input_tokens` and `output_tokens` are calculated

## Outcome Goal

Determine whether `rtk read` can realistically save tokens (and by how much),
or whether the rai extension should switch to a different approach for
reading files (e.g., skipping rtk entirely for reads, or using explicit
`--max-lines` flags).

If the default `--level none` is truly a passthrough (as it appears), the
extension's automatic `cat` → `rtk read` rewrite adds overhead (~61ms avg)
with zero token savings benefit for reads. The `rtk read` 14.9% average
then is entirely an artifact of measurement noise from a handful of reads.
