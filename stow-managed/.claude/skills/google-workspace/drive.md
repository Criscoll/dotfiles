# Drive — Allowed Command Surface

All Drive operations use wrapper scripts in `~/bin/agent_scripts/`. Direct gws-cli calls are blocked by the guard — do not call `uvx gws-cli@1.3.1 drive ...` directly.

**Read-only by design.** Only 5 of `drive`'s 30+ subcommands are wrapped: `list`, `search`,
`get`, `download`, `export`. No wrapper exists for uploading, deleting, sharing, moving,
copying, renaming, or any other mutating operation — see "Operations with no wrapper" below.

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

## Operations with no wrapper (do not attempt via raw gws-cli)

The following `drive` subcommands are intentionally unwrapped — they are mutating and
excluded from this read-only integration: `upload`, `delete`, `share`, `unshare`,
`move`, `copy`, `rename`, `update`, `create-folder`, `trash`, `untrash`,
`empty-trash`, `add-comment`, `update-comment`, `delete-comment`, `list-comments`,
`get-comment`, `add-permission`, `update-permission`, `remove-permission`,
`list-permissions`, `list-revisions`, `get-revision`, `delete-revision`,
`transfer-ownership`, `list-changes`, `watch-changes`.

If you need one of these, state what you need, confirm no existing wrapper covers it,
then ask the user to add a new wrapper script — do not call gws-cli directly.
