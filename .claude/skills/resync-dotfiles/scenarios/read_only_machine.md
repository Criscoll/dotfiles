# Scenario: Read-only machine (pull-only, upstream ledger)

A read-only machine cannot push to the dotfiles repo. Divergences that arise here must be recorded durably so they can be ported from a primary device — not re-litigated on every resync.

The **upstream ledger** (`$REPO_DIR/.resync-ledger.md`) and **overlay patches** (`.resync-overlays/*.patch`) are the two durable artifacts. Both are gitignored and survive `.resync/` deletion.

---

## 1. Initialise the ledger

On first run (or if the ledger is absent):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" init
```

This prompts once for READ-ONLY / READ-WRITE and writes the ledger with a hostname header. All subsequent skill invocations read this flag via:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" mode
```

If `mode` returns `READ-ONLY`: **never commit or push from this machine** — record divergences in the ledger instead.

---

## 2. The two registers

### Upstream-pending
Generic improvements made on this machine that belong in the shared repo, but can't be pushed from here. They should be ported from a primary device; once upstream lands and is pulled in, the reconcile pass auto-closes them.

### Local-only (machine-specific — never upstream)
Config that is intentional to this machine and should never go to the repo. The skill treats these as **known-intentional drift** and does not re-flag them as unexpected during triage.

---

## 3. The overlay mechanism

Some config files (e.g. apps that don't support a `.local` import) cannot have machine-specific edits factored out — the edit must live inline in the tracked (symlinked) file. This causes `git diff` drift on every run.

For each such file:
1. Choose `inline-overlay` in the decision menu below.
2. Run `add-overlay` to capture the current diff as a patch file.
3. After every subsequent `stow` (which writes a fresh symlink from the repo), run `reapply-overlays` to re-apply the patch.

The patch is auto-skipped once upstream absorbs the change (reconcile detects this).

---

## 4. Per-divergent-item decision menu

When a file appears as `DIFFERS`, `CONFLICT`, or `LOCAL_ONLY` during triage, present this menu and record the chosen disposition. Each choice maps to a concrete `ledger.sh` call.

| Choice | When to use | Action |
|---|---|---|
| `take-repo` | Repo version is correct; local edit is stale or wrong | Discard local, stow normally |
| `split-to-.local` | Local has machine-specific content the file supports extracting | Extract to `.local` file, stow the generic base |
| `upstream-pending` | Generic improvement; should land in the repo eventually | Record in Upstream-pending + capture overlay if needed |
| `local-only` | Machine-specific forever; never upstream | Record in Local-only |
| `inline-overlay` | Can't use a `.local`; edit must stay inline | Record in Upstream-pending + `add-overlay` to capture patch |

### Recording each decision

**take-repo**: no ledger entry needed; proceed with normal stow.

**split-to-.local**:
```bash
# Extract machine-specific content into ~/.zshrc.local (adjust filename)
# Then stow as normal
```
No ledger entry required.

**upstream-pending** (content _can_ live in `.local`):
```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" \
  add-upstream "stow-managed/<file>" "<short description of the change>"
```

**local-only**:
```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" \
  add-local "<file or ~/.local/path>" "<why it's machine-specific>"
```

**inline-overlay** (content _cannot_ move to `.local`):
```bash
# First record as upstream-pending
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" \
  add-upstream "stow-managed/<file>" "<description> (INLINE; no .local support)"

# Then capture the current diff as a patch
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" \
  add-overlay "<file relative to stow-managed/>"
```

---

## 5. After stow: re-apply overlays

After every stow run that touches a file with a registered overlay:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" reapply-overlays
```

Patches already in the tree are skipped (`ALREADY APPLIED`). Patches that fail to apply cleanly are flagged `CONFLICT` for manual resolution.

---

## 6. Reconcile pass (after git pull)

After pulling upstream changes, run the reconcile pass to auto-close entries whose changes have landed:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" reconcile
```

Any pending entry whose overlay patch now reverse-applies cleanly against HEAD is marked `[x]`. The reconcile output lists which overlays can be deleted.

---

## 7. Checking the backlog

At any time, surface what's still pending:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list-pending
```

This is run automatically at the start of each orientation stage.

---

## 8. Known-intentional drift during triage

During triage, cross-reference `DIFFERS`/`CONFLICT`/`LOCAL_ONLY` items against the ledger before presenting them as unexpected. Items already recorded as Local-only are **known-intentional** — note them as such and do not re-litigate.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ledger.sh" "$HOME_DIR" "$REPO_DIR" list
```

Items in the Local-only register → note as "intentional, skip". Items in Upstream-pending with an overlay → note as "known inline edit, will reapply after stow".
