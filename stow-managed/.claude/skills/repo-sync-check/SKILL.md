---
name: repo-sync-check
description: >-
  Discover every git repo directly under ~/Repos/, check each against its
  remote, ask the user which behind/diverged repos to pull, then bring the
  selected ones up to date via stash → pull --rebase → stash pop — walking
  through any rebase or stash-pop conflicts together with the user rather than
  guessing at a resolution. Use when the user says "check my repos", "are my
  repos up to date", "sync my repos", "pull rebase all repos", "check repos
  for drift", or "sync tracked repos".
disable-model-invocation: false
---

# Repo Sync Check

Walks every repo under `~/Repos/`, reports drift against each remote, lets
the user pick which ones to bring up to date, and does so via stash → pull
--rebase → stash pop — pausing to resolve conflicts with the user instead of
guessing.

## Repo discovery

Enumerate immediate subdirectories of `~/Repos/` that contain a `.git` entry:

```bash
for d in ~/Repos/*/; do [ -e "$d/.git" ] && echo "${d%/}"; done
```

Only go one level deep — don't recurse into subdirectories looking for
nested repos. A repo's own submodules or nested checkouts are handled by the
submodule-update step later, not treated as independent repos here.

This replaces any fixed allow-list: the skill's job is to surface *every*
repo under `~/Repos/`, not a curated subset, so the user always sees the full
picture before deciding what to touch.

## Workflow

Run repos sequentially, not in parallel — interleaved git output across
repos is hard to attribute, and a conflict in one repo shouldn't block
reporting on or pulling the others.

### 1. Survey every repo

For each discovered repo:

1. **Verify it's a git repo with a remote.** `git -C <repo> rev-parse
   --is-inside-work-tree`, then `git -C <repo> remote -v`. If it's not a git
   repo, report and skip. If it has no remote (e.g. a local-only scratch
   checkout), note it as `no remote — nothing to sync` and skip; this isn't a
   failure.
2. **Fetch, then compare.** `git -C <repo> fetch` followed by `git -C <repo>
   status -sb`. Classify as `clean`, `ahead N`, `behind N`, or `diverged`.

### 2. Ask which repos to pull

Present the survey to the user — one line per repo with its status. Only
`behind` and `diverged` repos need a decision; `clean` and `ahead` repos have
nothing to pull, so don't ask about them, just include them in the summary
for context.

If at least one repo is behind or diverged, use `AskUserQuestion`
(`multiSelect: true`) listing those repos so the user can pick which ones to
pull in one call. If none are behind or diverged, report the survey and
stop — there's nothing to sync.

### 3. Pull the selected repos

For each repo the user selected, in order:

1. **Check for uncommitted changes** (`git -C <repo> status --porcelain`).
   - If dirty, stash with a traceable message: `git -C <repo> stash push -u
     -m "repo-sync-check autostash $(date +%Y-%m-%dT%H:%M:%S)"`. `-u`
     includes untracked files so nothing new gets left behind or silently
     overwritten by the rebase.
2. Run `git -C <repo> pull --rebase`.
3. **On rebase conflict**, don't abort automatically — walk through it with
   the user:
   - Run `git -C <repo> status` to list the conflicting files, and show the
     conflict markers for each (or a summary if there are many).
   - Ask the user how to resolve, e.g. via `AskUserQuestion`: keep local
     changes (ours), keep incoming changes (theirs), resolve manually, or
     abort this repo's rebase. A wrong automatic guess would silently
     corrupt either side, and the user is the only one who knows which side
     is correct for their situation — so always get an explicit choice per
     repo before touching conflict markers.
   - If "ours"/"theirs": `git -C <repo> checkout --ours|--theirs -- <files>`,
     then `git -C <repo> add <files>` and `git -C <repo> rebase --continue`.
     Repeat if another commit in the rebase conflicts.
   - If "resolve manually": stop automated action for this repo, tell the
     user the exact remaining commands (`git add <files> && git rebase
     --continue`, or `git rebase --abort`), and wait for them to say it's
     done before re-checking status. Don't guess at timing.
   - If "abort": `git -C <repo> rebase --abort` to restore the pre-pull
     state, then move on to the next selected repo.
4. **Restore the stash** (only if one was created and the rebase
   succeeded/was completed): `git -C <repo> stash pop`.
5. **On stash-pop conflict**, same principle as step 3 — don't guess. Show
   the conflicting files and ask the user ours/theirs/manual. If they defer,
   leave the stash in place (never run `git stash drop`) and report the
   stash reference (`git -C <repo> stash list`) so they can resolve it
   later; the rebase itself already succeeded, so the repo is in a valid
   state and there's no urgency to force the pop.
6. **If the repo has submodules** (`.gitmodules` present) and the pull
   succeeded, run `git -C <repo> submodule update --init --recursive` — a
   plain pull doesn't update submodule pointers.

## Reporting

Summarize per repo in one line: `clean/up to date`, `ahead N`, `pulled N
commits`, `stashed + pulled + restored`, `skipped (no remote)`, or `NEEDS
ATTENTION: <reason>`. Put NEEDS ATTENTION repos last so they're the most
visible thing the user sees, since they're the only ones requiring further
action.

## Never

- Never `git push`, `--force`, or `git stash drop` — this skill only reads
  and fast-forwards local branches via rebase; anything destructive is out of
  scope even if a conflict looks trivial to resolve.
- Never resolve a conflict (rebase or stash-pop) without an explicit,
  per-repo choice from the user — a blanket default like "always keep ours"
  is exactly the kind of silent guess this skill exists to avoid.
- Never pull a repo the user didn't select in step 2, even if it's behind —
  surfacing drift and acting on it are separate steps.
