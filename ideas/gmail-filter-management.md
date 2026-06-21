# Cross-Device Gmail Filter Management

## The Problem

Email filtering is currently split across **local Thunderbird filters** and **Gmail server-side labels**, and there's no sync mechanism between them.

### Current topology

```
Layer                    | Where it lives        | Synced?
-------------------------|-----------------------|--------
Gmail server-side labels | Google cloud          | ✅ Always (it's Gmail)
Gmail server-side filters| Google cloud          | ✅ (but none exist — 0 filters)
Thunderbird msgFilter…   | Home PC (flatpak)     | ❌ Not synced
Thunderbird msgFilter…   | Laptop (flatpak)      | ❌ Not synced
```

Result: adjust filters on the home PC → the laptop's filter file never updates. Newsletters pile into the inbox on one machine while they're neatly sorted on the other. This is the "drift" that makes the experience inconsistent.

### Why Thunderbird filters are local-only

Thunderbird's `msgFilterRules.dat` lives inside the local profile directory:
- **Home PC**: `~/.var/app/org.mozilla.Thunderbird/.thunderbird/<profile>/ImapMail/imap.gmail.com/msgFilterRules.dat`
- **This laptop**: same relative path, different `<profile>` hash

These files are never synced to Gmail because Thunderbird applies filters **client-side** before the messages hit IMAP — Gmail only sees the resulting folder/label assignment, not the filter rules themselves. Two Thunderbird instances on two machines have independent filter configurations, and there's no mechanism to share them.

### What's at stake

The filter file on this laptop has **18 rules** covering:
- Newsletter categorization (sender-based, ~10 sub-categories)
- Bill/invoice routing
- Job/recruitment sorting
- Property/real estate
- Amazon order reference
- Invoice forwarding to Mimi
- Bulk archive/delete for specific senders
- Star/flag for specific senders

On this laptop, 6 of the newsletter sub-filters are **disabled**. On the home PC they may be enabled. No single source of truth.

### Previous sync attempt

Two backup scripts exist in the repo (`stow-managed/Scripts/thunderbird_upload.sh` and `thunderbird_download.sh`) that use `rclone` to sync the Thunderbird profile to Google Drive. These reference the old **snap** path (`~/snap/thunderbird/common/.thunderbird`) and are out of date — Thunderbird was migrated to Flatpak. They were never fully relied on because syncing a full profile (not just filters) is fragile: if both machines modify filters independently, the last sync wins and the other machine's changes are lost.

## What Was Investigated

### Gmail server-side filters

Gmail supports server-side filters that can:
- Apply labels (maps to IMAP folders — already the target of Thunderbird filters)
- Forward messages
- Delete/trash
- Star/mark important
- Categorize as Primary/Social/Promotions/Updates

Gmail filters are **universal** — they apply regardless of client (browser, phone, Thunderbird, Outlook, etc.). This means a filter set up once is active on every device forever. No sync needed.

Gmail filters are managed **only through the Gmail web UI or the Gmail API**. There is no downloadable "filters file" that can be synced via rclone or git. This was confirmed during this investigation.

### Gmail API filter management

The Gmail API has endpoints for managing filters:
- `GET /gmail/v1/users/me/settings/filters` — list all filters
- `POST /gmail/v1/users/me/settings/filters` — create a filter
- `DELETE /gmail/v1/users/me/settings/filters/{id}` — delete a filter

Each filter is represented as JSON with two parts:
```json
{
  "id": "...",
  "criteria": {
    "from": "sender@example.com",
    "subject": "...",
    "query": "..."
  },
  "action": {
    "addLabelIds": ["Label_5"],
    "removeLabelIds": ["INBOX"],
    "forward": "..."
  }
}
```

This means a script can **export filters to JSON → commit to the repo → import on another machine** (or re-apply from the same JSON after changes). The filter definitions become version-controlled text files.

### gws-cli and the guard

The repo already has `gws-cli` set up for Gmail access, with wrapper scripts in `~/bin/agent_scripts/`. The existing guard hook blocks destructive operations (send, delete, create-filter, etc.) at the subcommand level, so adding filter management would need either:
- New wrapper scripts with explicit allow-list entries in the guard
- Or relaxing the guard to allow filter management (less restrictive)

### What Gmail filters cannot do

| Thunderbird action | Supported in Gmail filter? |
|---|---|
| Apply label / move to folder | ✅ Yes (via `addLabelIds`) |
| Forward | ✅ Yes |
| Delete / Trash | ✅ Yes |
| Star / Flag | ✅ Yes |
| Run arbitrary script | ❌ No |
| **Mark as read** | ❌ **No** |
| Complex OR with 20+ senders | ⚠️ Clunky — each must be entered individually in the UI (API is fine) |

The one filter that truly can't be replicated server-side is "Mark Folder as Read" (type 144). This is a convenience filter that applies to all messages in the folder — not critical.

## Options

### Option A: Gmail API script + version-controlled filter JSON

A Python script (with PEP 723 inline deps, using the Google API client) that:
1. `gmail-filters export` — pulls all filters from Gmail as JSON → writes to a file in the repo
2. `gmail-filters import` — reads the JSON file → pushes filters to Gmail (replacing current)
3. `gmail-filters apply` — applies filters without wiping existing ones (supplemental)

Filters are tracked in the repo under something like `stow-managed/gmail/filters.json`.

**Pros:**
- Filters are version-controlled, diffable, reviewable
- Single source of truth
- Works with `git pull` on any machine → `gmail-filters import` → done
- Can be integrated into Stow or a hook

**Cons:**
- Requires Google API credentials set up on each machine
- Gmail API quota applies (though filters are cheap — ~1 unit each)
- Deleting all existing filters and re-importing is disruptive if done carelessly; needs a careful apply strategy

### Option B: Sync `msgFilterRules.dat` with fixes

Fix the existing rclone scripts to point at the Flatpak profile path, and narrow the sync from the entire profile to just `ImapMail/imap.gmail.com/msgFilterRules.dat`. Add a pre-hook that checks Thunderbird isn't running before syncing.

**Pros:**
- Preserves exact Thunderbird semantics, including Mark-as-Read and complex OR logic
- Minimal new tooling

**Cons:**
- Still fragile with concurrent edits on two machines
- Requires Thunderbird on every device
- Doesn't help if you access Gmail from a browser or phone — filters don't apply there
- Flatpak paths differ from native install paths — the current scripts are already stale

### Option C: Hybrid (Gmail filters + trim Thunderbird)

Move all sender-based label assignment into Gmail filters (exportable/importable JSON). Keep Thunderbird only for "Forward to Mimi" and "Mark Folder as Read." The `msgFilterRules.dat` shrinks to 2–3 rules and rarely changes.

**Pros:**
- Universal labeling + minimal Thunderbird-specific config
- Reduces drift surface area dramatically
- If Thunderbird goes away entirely, only two filters need replacement

**Cons:**
- Still two systems to maintain
- Need to keep Thunderbird around for those two actions (or find replacements)

### Option D: Full migration to mbsync + msmtp + NeoMutt

Already partially set up in the repo (`.mbsyncrc`, `.msmtprc` configs exist as WIP in stow-managed). Filters become scripts or `notmuch` tag rules.

**Pros:**
- Everything text-based, version-controllable
- Filters as shell scripts — arbitrarily powerful
- Works perfectly with agent tooling

**Cons:**
- No GUI — significant UX shift
- IMAP sync can be slower than Gmail API
- Learning curve for NeoMutt/notmuch

## Next Steps

1. **Decide on direction.** Options A (Gmail API) and B (fix sync) are the two practical paths. Options C and D are subsets or migrations of these.
2. **If A:**
   - Set up Gmail API credentials (OAuth client ID) and store in `~/.config/gws-filter-sync/`
   - Write the Python script with `google-api-python-client` as a PEP 723 dependency
   - Define the JSON schema for the filters file
   - Add a `gmail-filters` wrapper script to `~/bin/agent_scripts/`
   - Optionally add a pre-commit hook that verifies the filters JSON is valid
   - Run `export` on each machine, diff, reconcile to a single canonical file
3. **If B:**
   - Update the rclone scripts to reference the Flatpak profile path
   - Narrow the sync to just `ImapMail/*/msgFilterRules.dat` (not the whole profile)
   - Add a guard: check `thunderbird` isn't running before syncing
   - Add a `.stow-local-ignore` for the sync scripts on machines that don't need them
4. **In either case:** Normalise the filter state across machines first so there's one canonical set to start from.

## Reference

- Thunderbird filter file location (Flatpak): `~/.var/app/org.mozilla.Thunderbird/.thunderbird/<profile>/ImapMail/imap.gmail.com/msgFilterRules.dat`
- Gmail API filter docs: `GET /gmail/v1/users/me/settings/filters`
- Existing stale scripts: `stow-managed/Scripts/thunderbird_*.sh` (need path update)
- CLAUDE.md section on the `google-workspace` skill and guard hook
- Google Workspace skill: `~/.claude/skills/google-workspace/`
- gws-cli: `uvx gws-cli@1.3.0`