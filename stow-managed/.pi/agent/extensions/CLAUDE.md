# CLAUDE.md — pi extensions

Context for editing pi extensions in this directory. Adds to the root `CLAUDE.md`.

Invoke the `pi-extension-author` skill before creating or editing an extension — it
carries the pi extension API patterns (events, tools, TUI, `ctx`, state). Pi's full
docs live at `~/opt/pi/docs/`; read the relevant ones rather than relying on memory.

## TUI Conventions

When building custom TUI overlays or pickers (`ctx.ui.custom()`), apply these defaults:

- **Vim navigation**: `j`/`k` navigate down/up; translate them to arrow-key escape codes (`\x1b[B` / `\x1b[A`) before forwarding to list widgets. `l` selects; `h` goes back/cancels if meaningful (skip it for pickers where 'h' may be a search character).
- **Scroll shortcuts**: `gg` → top, `G` → bottom, `[`/`]` → prev/next section (for document views).
- **Count prefix**: accumulate digit presses as a count multiplier for j/k/G.
- **Search**: prefer type-to-filter over a dedicated search mode. Always show a hint line so it's discoverable.
- **Hint line**: every overlay must render a one-line summary of available keys at the bottom.

## Hook Instrumentation

Extensions that act as hooks should log via `withHookLogging` (wrap the handler;
self-degrades to pass-through when logging is impossible). Full details and the
analytics CLI are in `docs/hook-analytics-reference.md`.
