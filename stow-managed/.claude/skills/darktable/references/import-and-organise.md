# darktable: import, organise, find, move

What darktable can do to keep the library organised without manual filing. Sources: the darktable user manual (development and 4.x pages: variables, import module, preferences > import, collections) and r/DarkTable / discuss.pixls.us threads, read 2026-11-15. The user runs 5.6.2. Field names have changed between versions (e.g. "sub directory naming pattern" became "filmroll name"), so check the dialog before quoting one.

## Import modes (import module, lighttable)

- **add to library**: records existing files where they are. Writes database rows only, copies nothing. Use for folders already in the archive, or the in-place card fallback.
- **copy & import**: copies files from a folder or card to a location built from naming patterns, then imports the copies. This is what organises new cards automatically.
- **copy & import from camera**: same naming options, from a camera connected over USB/PTP. Cards in a reader use the previous mode.
- The import dialog lists files with thumbnails and lets you select a subset; whole-card import is the norm here.

## Naming patterns (copy & import)

Three parts: a **base directory** (parent folder), a **filmroll name** (sub-folder, one per film roll), and a **file naming pattern** (or "keep original filename"). Defaults are stored in `~/.config/darktable/darktablerc` as `session/base_directory_pattern`, `session/sub_directory_pattern`, `session/filename_pattern` and `session/use_filename`.

Variables that matter (from the manual's variables page):

| Variable | Meaning |
|---|---|
| `$(EXIF.YEAR)`, `$(EXIF.MONTH)`, `$(EXIF.DAY)` | capture date (`$(EXIF.MONTH.LONG)` / `.SHORT` for names) |
| `$(YEAR)`, `$(MONTH)`, `$(DAY)` | date of the import/export, **not** the capture date |
| `$(JOBCODE)` | the "import job" text typed in the dialog |
| `$(SEQUENCE[n,m])` | sequence number within the job |
| `$(FILE.NAME)`, `$(FILE.EXTENSION)` | source basename and extension |
| `$(FILE.FOLDER)` | full path of the folder holding the source image |
| `$(ROLL.NAME[n])` | film roll name, n folder levels from the right (default 1) |
| `$(PICTURES_FOLDER)`, `$(HOME)` | system folders |

The manual uses dotted names (`$(FILE.FOLDER)`). darktable's own defaults still use underscores (`$(FILE_FOLDER)`), so both forms seem to be accepted. Use dots in new patterns.

Agreed patterns for this user: base `…/01_PHOTOGRAPHY/Photos/$(EXIF.YEAR)`, filmroll `$(EXIF.YEAR)-$(EXIF.MONTH)-$(EXIF.DAY)`, keep original filename on.

**Verified 2026-11-15 (5.6.2):** variables work in the base directory, and `$(EXIF.MONTH)` and `$(EXIF.DAY)` are zero-padded (`2025/2025-06-28`).

**Still unverified:**
- Is the filmroll pattern evaluated per image within one import, so a multi-week card splits into day folders? The test only covered one day.
- What happens on a filename collision (e.g. a camera counter reset producing a second `DSCF0001` on the same day)?
- Does "delete (trash)" on the exFAT external drive go to `.Trash-1000` (no space freed until emptied) or delete outright?

A forum user using `$(PICTURES_FOLDER)/$(YEAR)/$(JOBCODE)` with job codes per import is the main precedent seen; per-day EXIF splitting is not confirmed by a source.

## Export path

The export module takes the same variables. Separate tree mirroring the originals: `…/Exports/$(EXIF.YEAR)/$(ROLL.NAME)/$(FILE.NAME)`. Never `$(FILE.FOLDER)` under another root: it expands to the full source path (darktable's default `$(FILE_FOLDER)/darktable_exported/$(FILE_NAME)` relies on that).

## Finding photos: collections module

- A collection is a set of rule-based filters over library attributes: film roll, folder, tag, rating, colour label, date attributes, camera/lens/exposure fields and more. The default collection is the last imported or selected film roll.
- Rules can be combined (narrow down / add / exclude), and collections can be saved as presets and recalled from recent collections. These are the "smart collections" used as a work queue (e.g. 4 stars and not green). Confirm the exact preset UI in 5.6.2.
- Date-based browsing (capture date by year/month/day) means the folder layout doesn't need to group by month or event. Check the attribute's exact name (e.g. "capture date") in 5.6.2 before naming it to the user.
- Preferences: "number of folder levels to show in lists" (film roll names show 1 level by default, so day folders read `2025-03-04`), and sort film rolls by folder name or import time.
- Film rolls whose files can't be found show struck through. Right-click > "update path to files…" re-points the roll after files were moved outside darktable. Entries for disconnected drives may stay struck through (no confirmed fix).

## Moving and copying inside darktable ("selected image(s)" in lighttable)

- **move**: moves the files (and XMPs) and updates the library, so paths stay correct. It works on images, not folders or film rolls, and needs an existing destination folder. There is no naming pattern, so a multi-day selection goes to one folder.
- **copy**: copies to a folder and imports the copy as a separate library entry.
- **copy locally / resync local copy**: local working copy for editing while the external drive is slow or unplugged. Confirm the button names in 5.6.2.
- **remove**: drops library entries only, files stay. **delete (trash)**: deletes files; whether a USB exFAT drive gets a trash folder or a permanent delete is not verified here, so check the "ask before" prompts before bulk-deleting rejects.
- Moving files with the shell instead (e.g. the migration script) is fine for folders darktable hasn't imported; otherwise use "update path to files…" afterwards.
