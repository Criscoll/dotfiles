#!/usr/bin/env bash
# ledger.sh — per-machine upstream ledger for read-only resync tracking.
#
# Usage:
#   bash ledger.sh HOME_DIR REPO_DIR <subcommand> [args...]
#
# Subcommands:
#   init                        — create ledger if absent (prompts for mode)
#   mode                        — print READ-ONLY or READ-WRITE from ledger header
#   list                        — print full ledger
#   list-pending                — print Upstream-pending block only
#   add-upstream <file> <note>  — append an Upstream-pending entry
#   add-local <file> <note>     — append a Local-only entry
#   add-overlay <file>          — capture git diff into .resync-overlays/<slug>.patch
#   reapply-overlays            — re-apply all patches not already in tree
#   reconcile                   — mark entries [x] when their overlay is absorbed upstream

set -euo pipefail

HOME_DIR="${1:?Usage: ledger.sh HOME_DIR REPO_DIR <subcommand> [args...]}"
REPO_DIR="${2:?Usage: ledger.sh HOME_DIR REPO_DIR <subcommand> [args...]}"
SUBCMD="${3:?Usage: ledger.sh HOME_DIR REPO_DIR <subcommand> [args...]}"
shift 3

LEDGER="$REPO_DIR/.resync-ledger.md"
OVERLAYS="$REPO_DIR/.resync-overlays"
HOSTNAME_VAL="$(hostname)"

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

_slug() {
  python3 -c "
import sys, re
s = sys.argv[1]
s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
print(s[:60])
" "$1"
}

_date() {
  date '+%Y-%m-%d'
}

_ensure_overlays_dir() {
  mkdir -p "$OVERLAYS"
}

# Extract the Machine mode line from the ledger header.
_read_mode() {
  if [[ ! -f "$LEDGER" ]]; then
    echo "UNKNOWN"
    return
  fi
  python3 -c "
import sys, re
with open(sys.argv[1]) as f:
    for line in f:
        m = re.match(r'^> Machine mode:\s*(READ-ONLY|READ-WRITE)', line)
        if m:
            print(m.group(1))
            sys.exit(0)
print('UNKNOWN')
" "$LEDGER"
}

# ---------------------------------------------------------------------------
# subcommands
# ---------------------------------------------------------------------------

cmd_init() {
  if [[ -f "$LEDGER" ]]; then
    echo "Ledger already exists: $LEDGER"
    echo "Machine mode: $(_read_mode)"
    return
  fi

  echo "No ledger found at $LEDGER."
  echo "Machine mode must be set explicitly — there is no default." >&2
  echo "Ask the user: can this machine push to the dotfiles repo?" >&2

  # Test if /dev/tty is usable before opening it (avoids bash error in agent contexts)
  _tty_ok=$(python3 -c "
import sys
try:
    open('/dev/tty')
    print('yes')
except OSError:
    print('no')
" 2>/dev/null)
  if [ "$_tty_ok" = "yes" ]; then
    printf "Can this machine push to the dotfiles repo? read-write (rw) or read-only (ro): " >&2
    read -r answer </dev/tty
    case "$answer" in
      rw|read-write|READ-WRITE|y|yes|Yes|YES) mode="READ-WRITE" ;;
      ro|read-only|READ-ONLY|n|no|No|NO)      mode="READ-ONLY" ;;
      *)
        echo "ERROR: unrecognised answer '$answer'. Re-run and enter 'rw' or 'ro'." >&2
        exit 1
        ;;
    esac
  else
    echo "ERROR: no terminal available. The agent must ask the user and pass the mode explicitly." >&2
    echo "Usage: set Machine mode manually by editing $LEDGER after creation, or re-run interactively." >&2
    exit 1
  fi

  cat > "$LEDGER" <<EOF
# Resync Ledger — $HOSTNAME_VAL
> Machine mode: $mode
> Last reconciled: $(_date)

## Upstream-pending
<!-- Generic improvements made here that belong in the repo but can't be pushed from this machine.
     Port from a primary device; they arrive on next pull and auto-close via reconcile. -->

## Local-only (machine-specific — never upstream)
<!-- Intentional to this machine. The skill preserves these and does NOT re-flag them as drift. -->
EOF

  echo "Created $LEDGER (mode: $mode)"
}

cmd_mode() {
  mode="$(_read_mode)"
  if [[ "$mode" == "UNKNOWN" ]]; then
    echo "UNKNOWN (ledger absent or mode line missing)" >&2
    exit 1
  fi
  echo "$mode"
}

cmd_list() {
  if [[ ! -f "$LEDGER" ]]; then
    echo "(ledger not initialised — run: bash ledger.sh $HOME_DIR $REPO_DIR init)"
    return
  fi
  cat "$LEDGER"
}

cmd_list_pending() {
  if [[ ! -f "$LEDGER" ]]; then
    echo "(no ledger)"
    return
  fi
  python3 -c "
import sys
with open(sys.argv[1]) as f:
    content = f.read()
# Extract the Upstream-pending block
import re
m = re.search(r'(## Upstream-pending.*?)(?=\n## |\Z)', content, re.DOTALL)
if m:
    block = m.group(1).strip()
    # Remove HTML comments
    block = re.sub(r'<!--.*?-->', '', block, flags=re.DOTALL).strip()
    print(block)
else:
    print('(no Upstream-pending section found)')
" "$LEDGER"
}

cmd_add_upstream() {
  file="${1:?add-upstream requires <file>}"
  note="${2:?add-upstream requires <note>}"
  stamp="$(_date)"

  python3 -c "
import sys, re
ledger, file, note, stamp = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(ledger) as f:
    content = f.read()

entry = '- [ ] %s — %s (%s)\n' % (file, note, stamp)

# Insert before end of Upstream-pending block (before next ## or EOF)
def insert_pending(m):
    block = m.group(0)
    # append before the trailing newlines that end the block
    return block.rstrip('\n') + '\n' + entry + '\n'

new = re.sub(r'## Upstream-pending[^\n]*\n(<!--.*?-->\n)?\n?', insert_pending, content, count=1, flags=re.DOTALL)
if new == content:
    # fallback: append at end
    new = content.rstrip() + '\n\n## Upstream-pending\n' + entry
with open(ledger, 'w') as f:
    f.write(new)
print('Added to Upstream-pending: %s' % file)
" "$LEDGER" "$file" "$note" "$stamp"
}

cmd_add_local() {
  file="${1:?add-local requires <file>}"
  note="${2:?add-local requires <note>}"

  python3 -c "
import sys, re
ledger, file, note = sys.argv[1], sys.argv[2], sys.argv[3]
with open(ledger) as f:
    content = f.read()

entry = '- %s — %s\n' % (file, note)

def insert_local(m):
    block = m.group(0)
    return block.rstrip('\n') + '\n' + entry + '\n'

new = re.sub(r'## Local-only[^\n]*\n(<!--.*?-->\n)?\n?', insert_local, content, count=1, flags=re.DOTALL)
if new == content:
    new = content.rstrip() + '\n\n## Local-only (machine-specific — never upstream)\n' + entry
with open(ledger, 'w') as f:
    f.write(new)
print('Added to Local-only: %s' % file)
" "$LEDGER" "$file" "$note"
}

cmd_add_overlay() {
  file="${1:?add-overlay requires <file>}"
  _ensure_overlays_dir

  # file is relative to stow-managed/ OR an absolute home path; normalise to stow-managed/ relative
  rel_stow="stow-managed/$file"
  if [[ ! -f "$REPO_DIR/$rel_stow" ]]; then
    echo "ERROR: $REPO_DIR/$rel_stow not found" >&2
    exit 1
  fi

  slug="$(_slug "$file")"
  patch_file="$OVERLAYS/${slug}.patch"

  # Capture the current diff from the working tree
  if ! git -C "$REPO_DIR" diff -- "$rel_stow" > "$patch_file"; then
    echo "ERROR: git diff failed" >&2
    exit 1
  fi

  if [[ ! -s "$patch_file" ]]; then
    rm -f "$patch_file"
    echo "No diff found for $rel_stow — file matches repo HEAD; no overlay created."
    return
  fi

  echo "Overlay captured: $patch_file"

  # Update the last Upstream-pending entry for this file to reference the overlay
  python3 -c "
import sys, re
ledger, file, patch = sys.argv[1], sys.argv[2], sys.argv[3]
with open(ledger) as f:
    content = f.read()

# Find the most recent pending entry for this file and append overlay ref
pattern = r'(- \[ \] ' + re.escape(file) + r'[^\n]*)(\n)'
rel_patch = patch.split(sys.argv[4] + '/')[-1] if sys.argv[4] in patch else patch
replacement = r'\1\n      overlay: .resync-overlays/' + rel_patch.replace('$OVERLAYS/', '') + r'\2'
new = re.sub(pattern, replacement, content, count=1)
if new == content:
    print('WARNING: could not find pending entry for %s to annotate with overlay' % file)
else:
    with open(ledger, 'w') as f:
        f.write(new)
    print('Annotated ledger entry with overlay reference.')
" "$LEDGER" "$file" "$patch_file" "$OVERLAYS"
}

cmd_reapply_overlays() {
  _ensure_overlays_dir

  patches=$(ls "$OVERLAYS"/*.patch 2>/dev/null || true)
  if [[ -z "$patches" ]]; then
    echo "No overlay patches found in $OVERLAYS/"
    return
  fi

  for patch in $patches; do
    name="$(basename "$patch")"
    # Check if already applied (reverse apply succeeds → patch is in tree)
    if git -C "$REPO_DIR" apply --reverse --check "$patch" 2>/dev/null; then
      echo "ALREADY APPLIED: $name"
      continue
    fi
    # Check if patch can apply cleanly
    if git -C "$REPO_DIR" apply --check "$patch" 2>/dev/null; then
      git -C "$REPO_DIR" apply "$patch"
      echo "APPLIED: $name"
    else
      echo "CONFLICT (needs manual merge): $name" >&2
    fi
  done
}

cmd_reconcile() {
  if [[ ! -f "$LEDGER" ]]; then
    echo "No ledger to reconcile."
    return
  fi

  _ensure_overlays_dir
  changed=0

  # For each pending entry with an overlay, check if the patch is now absorbed upstream
  python3 - "$LEDGER" "$OVERLAYS" "$(_date)" <<'PYEOF'
import sys, re, os, subprocess

ledger_path, overlays_dir, today = sys.argv[1], sys.argv[2], sys.argv[3]

with open(ledger_path) as f:
    content = f.read()

# Find all pending entries that reference an overlay
pattern = re.compile(
    r'(- \[ \] ([^\n]+)\n      overlay: \.resync-overlays/([^\n]+))',
    re.MULTILINE
)

new_content = content
closed = []

for m in pattern.finditer(content):
    full_entry, file_note, patch_name = m.group(1), m.group(2), m.group(3).strip()
    patch_path = os.path.join(overlays_dir, patch_name)

    if not os.path.isfile(patch_path):
        print('SKIP (overlay missing): %s' % patch_name)
        continue

    # If reverse-apply check succeeds, the change is already in the tree → absorbed upstream
    result = subprocess.run(
        ['git', '-C', os.path.dirname(overlays_dir), 'apply', '--reverse', '--check', patch_path],
        capture_output=True
    )
    if result.returncode == 0:
        print('CLOSED (absorbed upstream): %s' % file_note.split(' —')[0].strip())
        closed.append((full_entry, patch_path))

for full_entry, patch_path in closed:
    new_content = new_content.replace(full_entry, full_entry.replace('- [ ]', '- [x]'), 1)

if closed:
    # Update Last reconciled date
    new_content = re.sub(
        r'(> Last reconciled:) \d{4}-\d{2}-\d{2}',
        r'\1 ' + today,
        new_content
    )
    with open(ledger_path, 'w') as f:
        f.write(new_content)
    print('\n%d entry/entries closed. Update "Last reconciled" in ledger header.' % len(closed))
    print('Review and delete absorbed overlays:')
    for _, patch_path in closed:
        print('  rm %s' % patch_path)
else:
    print('No pending entries have been absorbed upstream yet.')
PYEOF
}

# ---------------------------------------------------------------------------
# dispatch
# ---------------------------------------------------------------------------

case "$SUBCMD" in
  init)             cmd_init ;;
  mode)             cmd_mode ;;
  list)             cmd_list ;;
  list-pending)     cmd_list_pending ;;
  add-upstream)     cmd_add_upstream "$@" ;;
  add-local)        cmd_add_local "$@" ;;
  add-overlay)      cmd_add_overlay "$@" ;;
  reapply-overlays) cmd_reapply_overlays ;;
  reconcile)        cmd_reconcile ;;
  *)
    echo "Unknown subcommand: $SUBCMD" >&2
    echo "Valid: init mode list list-pending add-upstream add-local add-overlay reapply-overlays reconcile" >&2
    exit 1
    ;;
esac
