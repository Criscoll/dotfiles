# AGENTS.md — User Defaults

Core defaults that apply across all projects and must always be followed. Project-specific `AGENTS.md` or `CLAUDE.md` files add context on top of these — they do not replace them.

---

## Reasoning Before Action

Before executing any non-trivial change, state:
1. What you plan to do
2. What the expected outcome is
3. What a failure would look like

Then act. Then compare results to the prediction. If they diverge, stop and explain why before trying a fix.

## When Things Break

Don't try fixes blindly. When something fails:
- State the error
- State your theory about the cause
- State what you'll do and what you expect
- Wait for confirmation if the fix is non-obvious or risky

Surprises indicate a wrong assumption. Find the assumption before pushing forward.

## Autonomy Boundaries

Stop and ask when:
- Intent is ambiguous
- The state of things is unexpected
- A change would be hard or impossible to reverse
- Uncertainty is high and consequences are significant

The cost of pausing is always lower than the cost of a wrong path.

When multiple unknowns need resolving before proceeding, batch them into a single message with clearly labelled options rather than asking one question at a time.

## Testing

Run one test, watch it pass, then move to the next. Don't batch untested changes.

## Response Style

- Lead with the answer or action
- Reasoning is fine, but it follows the answer — never precedes it
- Skip preamble, filler phrases, and trailing summaries
- No emojis unless explicitly asked
- Use `file:line` references when pointing to code
- Prefer editing existing files over creating new ones

## Search Tool Environment

**rtk rewrites search commands for token efficiency.** Both Claude Code and pi run an `rtk hook` layer that silently rewrites commands before they execute:
- `rg` → `rtk grep`  (uses ripgrep internally, but `-l` falls back to system grep — fails on dirs)
- `git status` → `rtk git status`, `ls` → `rtk ls`, etc.

**How to spot rtk influence in errors:** If you see `/usr/bin/grep: <path>: Is a directory` from an `rg -l` invocation, rtk's `-l` delegation to system grep is the cause — use `rg <pattern> <path>` (without `-l`) for directory searches.

**Correct rg usage** (applies in both harnesses):
- Recursive by default — never use `-r` (that means `--replace`)
- Alternation: `rg 'foo|bar' path/` not `rg 'foo\|bar' path/`
- File-type filter: `--type ts` not `--include '*.ts'`
- Multiple patterns: `-e 'pat1' -e 'pat2'` or `'pat1|pat2'`

## What Not to Do

- Don't add features, refactors, or improvements beyond what was asked
- Don't add comments, docstrings, or type annotations to code you didn't change
- Don't create helpers or abstractions for one-time operations
- Don't handle error cases that can't happen; trust internal guarantees
- Don't commit without being explicitly asked
