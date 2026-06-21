---
name: batch-commit
description: Analyse unstaged changes in the current repo, split them into logical groups by concern, and create one commit per group with an appropriate message. Use when the user says "batch commit", "split my changes into commits", "commit my changes logically", or similar.
disable-model-invocation: false
---

You are running the batch-commit skill. Your job is to inspect all unstaged changes in the current repository, group them by logical concern, and create one commit per group — without pushing anything.

## Step 1: Survey the working tree

Run these in parallel:

```
git status
git diff
git diff --cached
```

Also note any untracked files from `git status` that are likely intentional (not build artifacts or temp files).

## Step 2: Propose a grouping

Analyse the full diff and identify logical commit boundaries. A good split follows these heuristics:
- Changes to the same feature, component, or config section belong together
- Unrelated fixes or additions belong in separate commits
- New files that are tightly coupled to changed files belong in the same commit
- Mechanical changes (renames, reformats) get their own commit if mixed with logic changes

Present the proposed grouping to the user as a numbered list before doing anything:

```
Proposed commits:

  1. [scope]: short description
     Files: foo.lua, bar.lua

  2. [scope]: short description
     Files: baz.conf

  ...

Proceed with these commits? (yes / adjust N / skip N)
```

Wait for the user's confirmation or adjustments before committing anything.

## Step 3: Apply adjustments (if any)

If the user requests changes to the grouping, revise and re-present the list. Do not commit until the user confirms.

## Step 4: Create the commits

For each group in order:
1. Stage only the files for that group: `git add <files>`
2. Commit with the agreed message
3. Verify the commit was created: `git log --oneline -1`

Run steps 1–3 sequentially per group (each commit depends on the previous staging being clean). Do not stage all files at once.

Use the commit message format native to the repo if one is apparent from `git log --oneline -10`. Otherwise default to:
```
<scope>: <imperative short description>
```

**Commit message structure:** default to a short body (1–3 sentences) for every commit. The body should summarise what was changed at a high level and why these files are grouped together as a logical unit. This is lighter than a hand-crafted commit message — skip trade-offs, alternatives considered, or issue references unless they're immediately relevant — but it provides far more context than a bare one-liner.

A one-liner is acceptable only when the change is trivially obvious from the diff alone (e.g. a single typo fix, a one-word rename). When in doubt, add the body.

Subject lines follow the conventions from the `commit-message` skill (see `stow-managed/.claude/skills/commit-message/SKILL.md`): imperative mood, ≤50 characters (72 hard cap), capitalised, no trailing period. Body wraps at 72 characters.

Example:
```
fix(websearch): handle concurrent parallel cold-start races

The SearXNG container name check had a race when two skill calls started at
the same time. Added `|| true` to suppress the "already exists" error so
one caller's `docker run -d` doesn't fail the other.
```

Never use `git add -A` or `git add .` — always stage specific files by name to avoid accidentally including unintended files.

Never push. Never amend existing commits. Never use `--no-verify`.

## Step 5: Summary

After all commits are created:

```
Created N commits:
  abc1234  <message>
  def5678  <message>
  ...

Nothing was pushed.
```
