---
name: pi-extension-author
description: >-
  Apply pi extension API patterns (events, tools, TUI, ctx, state) from proven extensions and official docs. Auto-invoke BEFORE creating or editing any pi extension file. Trigger phrases: "pi extension", "pi-extension", "ExtensionAPI", "registerTool", "registerCommand", "pi.on(", ".pi/agent/extensions", "extension for pi".
disable-model-invocation: false
---

You are working on a pi agent extension. Apply the rules below before writing any code.

## Orientation

**File locations:**
- Global extensions: `~/.pi/agent/extensions/*.ts` or `~/.pi/agent/extensions/*/index.ts`
- Project-local: `.pi/extensions/*.ts` or `.pi/extensions/*/index.ts`
- This repo's extensions: `stow-managed/.pi/agent/extensions/` (symlinked → `~/.pi/agent/extensions/`)

**Hot reload:** `/reload` inside pi. Test with `pi -e ./path.ts` for quick iteration.

**Docs:** `~/opt/pi/docs/` — read `extensions.md` for the full API, `tui.md` for TUI components.

---

## Rule 1: Check Existing Extensions First

Before implementing any pattern, check whether an existing extension already solves it. Copy and adapt rather than rebuild from scratch.

| Pattern needed | File to read |
|---|---|
| SelectList picker with type-to-filter | `prompt-history.ts` |
| Multi-tab questionnaire with options | `ask-user.ts` |
| Plan mode + overlay with vim navigation | `inline-plan.ts` |
| Custom footer bar (model, tokens, cost) | `context-ui.ts` |
| Tool call interception / block dangerous commands | `dangerous-commands.ts` |
| Intercept and warn (but allow) inefficient commands | `inefficient-commands.ts` |
| Streaming tool that calls a subprocess | `web-search.ts` |
| CRUD tool + `/todos` command with UI | `todos.ts` |
| Desktop notifications via OSC sequences | `notify-ready.ts` |

All files live in `stow-managed/.pi/agent/extensions/`. Read the relevant one before writing new code.

---

## Rule 2: Prefer Built-in TUI Components

Import from `@earendil-works/pi-tui` and `@earendil-works/pi-coding-agent`. These are battle-tested — do not reimplement them.

**Go-to for list selection:** `SelectList` — handles filtering, keyboard nav, onSelect/onCancel. Use it for any picker UI.

| Component | Where from | Use for |
|---|---|---|
| `SelectList` | `pi-tui` | Any list picker; supports type-to-filter, onSelect, onCancel |
| `DynamicBorder` | `pi-coding-agent` | Themed top/bottom borders for overlays |
| `Container` | `pi-tui` | Vertical stack of child components |
| `Text` | `pi-tui` | Multi-line text with word wrap and padding |
| `Markdown` | `pi-tui` | Rendered markdown (use `getMarkdownTheme()` from `pi-coding-agent`) |
| `Editor` | `pi-tui` | Multi-line text input with submit callback |
| `BorderedLoader` | `pi-coding-agent` | Spinner + cancel for async operations |
| `SettingsList` | `pi-tui` | Toggle list for settings UI |
| `Spacer` | `pi-tui` | Empty vertical space |

---

## Rule 3: TUI Navigation Conventions

Every custom overlay **must** follow these conventions (from CLAUDE.md):

- **`j`/`k`** navigate down/up — translate to arrow-key escapes before forwarding to `SelectList`: `"\x1b[B"` / `"\x1b[A"`
- **`l`** selects (equivalent to Enter); `h` goes back/cancels where it makes sense
- **`gg`** → top; **`G`** → bottom; **`[`/`]`** → prev/next section (document views)
- **Count prefix**: accumulate digit presses as a multiplier for j/k/G
- **Type-to-filter** preferred over a dedicated search mode
- **Hint line required**: every overlay must render a one-line key summary at the bottom
- **Guard TUI-only code** with `ctx.mode === "tui"` or `ctx.hasUI`

Forwarding vim keys to `SelectList`:
```typescript
if (data === "j") selectList.handleInput("\x1b[B");
else if (data === "k") selectList.handleInput("\x1b[A");
else if (data === "l") selectList.handleInput("\r");
else selectList.handleInput(data);
tui.requestRender();
```

---

## Minimal Extension Skeleton

**Sync (most extensions):**
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });
}
```

**Async factory (for startup fetches, e.g. dynamic model discovery):**
```typescript
export default async function myExtension(pi: ExtensionAPI): Promise<void> {
  const data = await fetch("...").then(r => r.json());
  pi.registerProvider("my-provider", { /* ... */ });
}
```

---

## Load Reference Files When Relevant

Read these with the Bash tool. Do not guess their contents — read them.

```bash
cat "$CLAUDE_SKILL_DIR/references/api.md"
cat "$CLAUDE_SKILL_DIR/references/tui.md"
```

- **`references/api.md`** — load when implementing tools, commands, shortcuts, events, ctx methods, message injection, or state management (session persistence, branch reconstruction)
- **`references/tui.md`** — load when building custom TUI overlays, pickers, forms, or footers via `ctx.ui.custom()`
