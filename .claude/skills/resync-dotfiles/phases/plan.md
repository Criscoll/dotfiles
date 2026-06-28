# Stage: Plan

Writes (or annotates) `$RESYNC_DIR/plan.md`. Reads `HOME_DIR`, `REPO_DIR`, and `RESYNC_DIR` from context (SKILL.md Step 0).

## Check for existing plan

```bash
[ -f "$RESYNC_DIR/plan.md" ] && echo "plan.md exists" || echo "plan.md absent"
```

- **plan.md absent** → proceed to [Generate plan](#generate-plan)
- **plan.md exists** → skip to [Annotation cycle](#annotation-cycle)

---

## Generate plan

Read triage.md:

```bash
cat "$RESYNC_DIR/triage.md"
```

### Classify each file

Using the inventory, timeline, diff, and sensitive findings from triage.md, assign each file a category:

| Category | Meaning |
|---|---|
| `CLEAN_APPLY` | Repo can be applied directly; local has nothing different that matters |
| `LOCAL_MIGRATION` | Local has machine-specific or sensitive content to extract into a `.local` file before stowing |
| `CONFLICT` | Both sides changed the same setting incompatibly; needs explicit user decision |
| `LOCAL_ONLY_ADDITIONS` | Local has content the repo doesn't — classify via decision menu (see below) |
| `MISSING_LOCALLY` | File in repo but not on machine; straightforward to apply |
| `SENSITIVE_IN_REPO` | Repo version contains content that should not be tracked; remediation required before applying |

For `CONFLICT` files, describe the nature of the conflict clearly (incompatible values, structural divergence, etc.).

For `LOCAL_ONLY_ADDITIONS` and `CONFLICT` items on a READ-ONLY machine, apply the per-item decision menu from `scenarios/read_only_machine.md`. Each item gets one of these dispositions:

| Disposition | Meaning |
|---|---|
| `take-repo` | Discard local, stow normally |
| `split-to-.local` | Extract machine-specific parts to a `.local` file, stow generic base |
| `upstream-pending` | Generic change; record in ledger for porting from primary device |
| `local-only` | Machine-specific forever; record in ledger, never upstream |
| `inline-overlay` | Can't use `.local`; record + capture overlay patch |

On a READ-WRITE machine, treat LOCAL_ONLY_ADDITIONS as candidates for committing from this machine — note in the plan for the upstream step.

### Check for install-now tool decisions

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list-tools
```

Any tool with decision `install-now` goes into the "Tools to Install" section of the plan. For each tool, look up the install command in the reference file:

```bash
cat "${CLAUDE_SKILL_DIR}/references/tool-installs.md"
```

Use the table to populate the install command. Only fall back to "install method unknown — user to confirm" if the tool is not listed in the reference.

### Write plan.md

Use the Write tool to create `$RESYNC_DIR/plan.md`:

```markdown
# Resync Plan
> Stage: plan — pending approval

## Missing Locally → Apply
- [ ] file1
- [ ] file2
(or: none)

## Clean Apply (identical or repo superset)
- [ ] file
(or: none)

## Local Migration Required
- [ ] file — [what needs extracting and to which .local file]
(or: none)

## Conflicts — Fill in decision below each
- [ ] file — DIFFERS, LOCAL newer
  // decision: (take repo / take local / merge / defer)
(or: none)

## Local-only Additions
- [ ] file — disposition: (take-repo / split-to-.local / upstream-pending / local-only / inline-overlay)
(or: none)

## Sensitive in Repo (remediation required before apply)
- [ ] file — [what was found]
(or: none)

## Tools to Install
- [ ] rtk — `download from github.com/rtk-ai/rtk/releases; verify sha256` (from references/tool-installs.md)
(or: none)

## Collapsible Dirs
- [ ] dir — [N files; description]
  Tradeoff: [one sentence on collapse vs keep]
  // decision: (collapse / leave as-is — reason: ___)
(or: none)

## Status: PENDING
<!-- When all conflict decisions and collapsible dir choices are filled in, change PENDING to APPROVED -->
```

Tell the user:

> Plan written to `.resync/plan.md`.
> Open it, fill in a `// decision:` for each conflict and each collapsible dir, then change `## Status: PENDING` to `## Status: APPROVED`.
> Run `/clear` and re-invoke `/resync-dotfiles` when ready.

---

## Annotation cycle

plan.md exists but Status is not APPROVED. Re-read it:

```bash
cat "$RESYNC_DIR/plan.md"
```

Identify conflicts or collapsible dirs that still have blank `// decision:` lines. Present them to the user clearly.

If the user fills in decisions in-conversation or says "approved":

1. Update the plan.md file with any in-conversation decisions (use Edit tool for each `// decision:` line)
2. Update the Status line:

```bash
sed -i 's/## Status: PENDING/## Status: APPROVED/' "$RESYNC_DIR/plan.md"
```

3. Confirm the update:

```bash
grep "## Status" "$RESYNC_DIR/plan.md"
```

Tell the user:

> Plan approved. Run `/clear` and re-invoke `/resync-dotfiles` to begin execution.

If the user wants to revise classifications instead, explain that they can edit `plan.md` directly, or run `/resync-dotfiles plan` after clearing to regenerate.
