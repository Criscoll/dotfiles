---
name: repo-sync-check
description: >-
  Check whether specific tracked repos under ~/Repos/ are behind their remote,
  then stash local changes, pull with rebase, and restore the stash for each —
  flags any rebase or stash-pop conflict for manual resolution instead of
  guessing at a fix. Use when the user says "check my repos", "are my repos up
  to date", "sync my repos", "pull rebase all repos", "update dotfiles and
  scribbles", "check repos for drift", or "sync tracked repos".
disable-model-invocation: false
---

# Repo Sync Check

Checks a fixed list of repos for drift against their remote and brings each up
to date via stash → pull --rebase → stash pop, without silently resolving
conflicts.

## Repos in scope

Only operate on repos explicitly listed here — this skill must never walk all
of `~/Repos/` and touch repos the user hasn't opted in, since an unexpected
pull/rebase on an unrelated repo could interrupt someone else's in-progress
work.

- `~/Repos/dotfiles`
- `~/Repos/scribbles`

Add a repo to this list only when the user explicitly asks for it to be
included.

## Workflow

Run repos sequentially, not in parallel — interleaved git output across repos
is hard to attribute, and a conflict in one repo shouldn't block reporting on
the others.

For each repo in scope:

1. **Verify it's a git repo with a remote.** `git -C <repo> rev-parse
   --is-inside-work-tree` and check `git -C <repo> remote -v`. If either
   fails, report and skip — don't try to fix an unexpected repo state.
2. **Fetch, then compare.** `git -C <repo> fetch` followed by `git -C <repo>
   status -sb`. This alone answers "is it up to date" — if the user only
   asked to check, stop here for that repo and report
   ahead/behind/diverged/clean.
3. **If behind and a pull is requested**, check for uncommitted changes
   (`git -C <repo> status --porcelain`):
   - If dirty, stash with a traceable message: `git -C <repo> stash push -u
     -m "repo-sync-check autostash $(date +%Y-%m-%dT%H:%M:%S)"`. `-u`
     includes untracked files so nothing new gets left behind or silently
     overwritten by the rebase.
   - Run `git -C <repo> pull --rebase`.
4. **On rebase conflict:** run `git -C <repo> rebase --abort` immediately to
   restore the pre-pull state, then report the repo and the conflicting files
   to the user and stop for that repo. Do not attempt to auto-resolve
   conflict markers — a wrong guess silently corrupts either the incoming or
   local change, and the user is the only one who knows which side is
   correct. Move on to the next repo.
5. **Restore the stash** (only if one was created and the rebase succeeded):
   `git -C <repo> stash pop`.
6. **On stash-pop conflict:** leave the stash in place — do not run `git
   stash drop`. Report the conflict and the stash reference (`git -C <repo>
   stash list`) so the user can resolve it manually; the rebase itself
   already succeeded, so the repo is in a valid state and there's no urgency
   to force the pop.
7. **If the repo has submodules** (`.gitmodules` present) and the pull
   succeeded, run `git -C <repo> submodule update --init --recursive` — a
   plain pull doesn't update submodule pointers, and repos like dotfiles rely
   on submodules (`powerlevel10k`, `tpm`, `tmux-resurrect`, `tmux2k`) staying
   in sync.

## Reporting

Summarize per repo in one line: `clean/up to date`, `pulled N commits`,
`stashed + pulled + restored`, or `NEEDS ATTENTION: <reason>`. Put NEEDS
ATTENTION repos last so they're the most visible thing the user sees, since
they're the only ones requiring action.

## Never

- Never `git push`, `--force`, or `git stash drop` — this skill only reads
  and fast-forwards local branches via rebase; anything destructive is out of
  scope even if a conflict looks trivial to resolve.
- Never operate on a repo outside the "Repos in scope" list without the user
  adding it there first.
