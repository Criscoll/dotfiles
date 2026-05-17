---
name: sync-session-notes
description: Sync end-of-session progress across the docs that track a project — task outline (checklist), CLAUDE.md (technical reference), and README.md (user-facing docs). Use when the user says "update the task outline", "sync the docs", "update notes with progress", "end of session", or "sync session notes".
disable-model-invocation: false
---

You are syncing end-of-session progress across the documents that track the current project.

`$ARGUMENTS` may specify what was completed this session. If absent, infer from conversation history.

## The documents to update

Work from the current repo root (derive it from the conversation or `git rev-parse --show-toplevel`).

1. **Task outline** — a checklist tracking what's planned, in progress, and done. It may live in the repo or in a companion notes repo (e.g. under `~/Repos/scribbles/`). Search if the path isn't obvious:
   ```bash
   find ~/Repos/scribbles -name "outline.md" 2>/dev/null | head -5
   find . -name "outline.md" -not -path "*/node_modules/*" 2>/dev/null | head -5
   ```
   Tick completed items with `[x]`. Move newly discovered work into the appropriate "next" section.

2. **CLAUDE.md** — technical reference for future Claude sessions. Update:
   - `## What's Built` (or equivalent) — add newly completed features/scripts with a one-line description and usage
   - `## What's Next` (or equivalent) — remove done items, add newly surfaced items in priority order

3. **README.md** — user-facing docs. Update setup instructions, feature list, or usage examples only if the session changed something a user would see or run.

## Steps

1. Locate the repo root and all three documents. Read each one.
2. Identify what was completed this session (from `$ARGUMENTS` or conversation context).
3. For each document, decide what to change:
   - Outline: tick completed tasks
   - CLAUDE.md: update What's Built / What's Next sections
   - README.md: update only if user-facing behaviour changed
4. Apply all edits. Show the user a one-line summary per file of what changed.
5. Remind the user to commit — do not commit automatically.

## Rules

- Do not rewrite sections wholesale. Make targeted edits: tick items, append entries, remove completed items.
- If a document is not found, tell the user and skip it rather than failing.
- README.md often needs no changes — only update it if something the user would read changed (new command, new output file, changed usage).
- If the project uses different section names than "What's Built / What's Next", adapt — look at the actual headings rather than assuming.
