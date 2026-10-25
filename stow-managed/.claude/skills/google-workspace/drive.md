# Drive — Allowed Command Surface

All Drive operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.1 drive ...` directly.

**Read plus reversible changes only.** Of `drive`'s 30+ subcommands the wrappers cover reading
(`list`, `search`, `get`, `download`, `export`, permission listing) and four changes that can be
undone: trash, restore, move, rename. Nothing permanent is wrapped — no upload, permanent
delete, sharing, copying or other mutating operation; see "Operations with no wrapper" below.

To read or edit native Docs/Sheets content, use docs.md / sheets.md.

## Listing and searching

```bash
# List files (root of My Drive, most recent 100 by default)
~/bin/agent_scripts/drive-list
~/bin/agent_scripts/drive-list --max 20
~/bin/agent_scripts/drive-list --folder <folder-id>
~/bin/agent_scripts/drive-list --page-token <token>   # pagination

# Search with Drive query syntax
~/bin/agent_scripts/drive-search "name contains 'invoice'"
~/bin/agent_scripts/drive-search "mimeType = 'application/pdf'" --max 50
```

Both print one line per file: `id | name | mimeType | modifiedTime | size`.

## Drive search query syntax

| Clause | Meaning |
|---|---|
| `name contains 'text'` | filename substring match |
| `mimeType = 'application/pdf'` | exact MIME type match |
| `modifiedTime > '2024-01-01'` | modified after date |
| `'folder_id' in parents` | files inside a specific folder |
| `trashed = false` | exclude trashed files (often implicit) |

Combine clauses with `and` / `or`:

```bash
~/bin/agent_scripts/drive-search "name contains 'report' and mimeType = 'application/pdf'"
~/bin/agent_scripts/drive-search "'1AbCdEfGhIjKlMnOp' in parents and modifiedTime > '2026-01-01'"
```

Common MIME types: `application/vnd.google-apps.document` (Google Doc),
`application/vnd.google-apps.spreadsheet` (Google Sheet),
`application/vnd.google-apps.presentation` (Google Slides),
`application/vnd.google-apps.folder` (folder), `application/pdf`.

## Getting file metadata

```bash
~/bin/agent_scripts/drive-get <file-id>
```

Prints `Key: value` lines for id, name, MIME type, size, created/modified time,
description, starred/trashed flags, parents, view/download links, and owners.

## Downloading

```bash
# Regular (non-Google-native) files — binary download as-is
~/bin/agent_scripts/drive-download <file-id> <filename>
# Saves to ~/Downloads/drive-files/<filename>, prints the saved path to stdout
# Optional: --out-dir <dir> to override the destination directory
```

Use `drive-download` for files that already have a concrete MIME type (PDFs, images,
`.docx`/`.xlsx` uploads, etc.) — i.e. anything that is not a native Google Docs/Sheets/Slides
file. Native Google files cannot be downloaded directly; use `drive-export` instead.

## Exporting native Google files

```bash
# Google Docs/Sheets/Slides must be exported to a concrete format
~/bin/agent_scripts/drive-export <file-id> <filename>
# Default export format is application/pdf (gws-cli's own default)
~/bin/agent_scripts/drive-export <file-id> report.pdf

# Override format
~/bin/agent_scripts/drive-export <file-id> data.xlsx --format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Optional: --out-dir <dir> to override the destination directory
```

Saves to `~/Downloads/drive-files/<filename>` by default, prints the saved path to stdout.

## Viewing downloaded content

```bash
# Use the /pdf-parse skill for PDFs, /image-read skill for images
```

## Who has access

```bash
~/bin/agent_scripts/drive-permissions <file-id>
# permission_id | type | role | email | display_name | domain | expires     (one line each, '-' if empty)
```

Read-only. **Sharing cannot be changed** — there is no wrapper to share, unshare, or edit permissions; if access needs changing, tell the user.

## Trash and restore

```bash
~/bin/agent_scripts/drive-trash <file-id>              # Trashing: name | mimeType | parents
~/bin/agent_scripts/drive-trash <folder-id> --folder   # folders need the explicit flag
~/bin/agent_scripts/drive-restore <file-id>            # Restored: name
```

`drive-trash` moves the file to the trash and **never deletes permanently**; it prints the exact `drive-restore` command to undo. It refuses a file that is already trashed, and refuses a folder without `--folder` (trashing a folder hides everything inside it). `drive-restore` refuses a file that is not in the trash. Confirm with `drive-get <id>` (`Trashed: True`). Works for Docs and Sheets too. Emptying the trash and permanent delete are not available.

## Moving

```bash
~/bin/agent_scripts/drive-move <file-id> <folder-id>
# Moving: name from [old parents] to [folder (id)]
# Undo: drive-move <file-id> <old-parent>
```

**A move replaces ALL of the file's existing parents** with the one destination folder. The old parents and the undo command are printed before the move, and the resulting parents after it. The destination must be a folder (find ids with `drive-search "mimeType = 'application/vnd.google-apps.folder'"`). A file that had several parents cannot be restored with one command — the output says so.

## Renaming

```bash
~/bin/agent_scripts/drive-rename <file-id> "New name"
# Renamed: 'old' -> 'new'
```

Changes the name only, never the content. For a native Doc/Sheet the Drive name is the document's title. Undo by renaming back to the printed old name.

## Operations with no wrapper (do not attempt via raw gws-cli)

The following `drive` subcommands are intentionally unwrapped — they are permanent, share
data outward, or re-upload content: `upload`, permanent `delete`, `share`, `unshare`, `copy`,
`update`, `create-folder`, `empty-trash`, `add-comment`, `update-comment`, `delete-comment`,
`list-comments`, `get-comment`, `add-permission`, `update-permission`, `remove-permission`,
`list-revisions`, `get-revision`, `delete-revision`, `transfer-ownership`, `list-changes`,
`watch-changes`.

If you need one of these, state what you need, confirm no existing wrapper covers it,
then ask the user to add a new wrapper script — do not call gws-cli directly.
