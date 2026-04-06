# Phase 6: Produce the Plan

Present a structured sync plan using the classifications from Phase 5. Use this exact format:

---

## Sync Plan

### Already in sync (symlinked)
- [list files, or "none"]

### Missing locally — straightforward to apply
- `[file]`: [what it provides]

### Clean apply — repo version replaces local
- `[file]`: [what the repo version adds or changes vs local]

### Require local migration first
- `[file]`
  - Local content to extract: [describe what and why]
  - Proposed .local file: [e.g. `~/.zshrc.local`]
  - Main config sources it: [yes / needs adding]

### Conflicts requiring manual resolution
- `[file]`
  - Local has: [describe]
  - Repo has: [describe]
  - Nature of conflict: [incompatible values / structural difference / etc.]
  - Resolution: [ ] take repo  [ ] take local  [ ] merge  [ ] defer

### Local-only additions (assess intent)
- `[file]`: [describe additions — machine-specific or potentially generic?]

### Sensitive data found in repo (remediation required)
- `[file]`: [what was found, line reference if possible]

### Fragmented directories (collapsible to a single dir symlink)

For each `COLLAPSIBLE_DIR`, present:
- The directory path
- What is inside (file count, brief description of contents)
- The tradeoff: collapsing gives a cleaner structure and means new repo files appear automatically; leaving as-is preserves the ability to add local-only files alongside tracked ones

Ask the user for each one: **collapse or leave as-is, and why?**

If the user chooses **leave as-is**, record their reason and respond with judgment:
- "I plan to add a local-only file here" → note that this is the right call; suggest naming conventions if relevant (e.g. a `.local.lua` companion file pattern for neovim plugins)
- "I'm not sure" → help them decide based on the directory's contents and likely use
- "It's fine as-is" → accept it; note that running `/resync` in future will flag it again unless collapsed

Format in the plan:
```
- `[dir]`: [N files, description]
  Tradeoff: [one sentence on collapse vs keep]
  Action: [ ] collapse  [ ] leave as-is
  Reason (if leave as-is): ___
```

---

**Stop here.** Present this plan and wait for the user to:
1. Review and annotate each item
2. Fill in a resolution for every conflict (`take repo` / `take local` / `merge` / `defer`)
3. Explicitly say "approved" or request revisions

Do not touch any files until the user has explicitly approved.

## Next

```bash
# User approved the plan:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 6 approved

# User wants to revise classifications first:
python3 ${CLAUDE_SKILL_DIR}/resync.py --route 6 needs_revision
```

Then fetch and execute the phase it returns.
