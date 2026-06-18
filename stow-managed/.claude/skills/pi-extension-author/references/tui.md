# pi TUI Reference

## ctx.ui.custom() — Factory Pattern

```typescript
const result = await ctx.ui.custom<T>(
  (tui, theme, keybindings, done) => {
    // done(value) resolves the promise and closes the component
    return {
      render(width: number): string[],   // must not exceed width; truncate with truncateToWidth()
      handleInput(data: string): void,   // receive keyboard input; call tui.requestRender() after state changes
      invalidate(): void,                // clear cached render state (called on theme changes)
      dispose?(): void,                  // optional cleanup (e.g. editor.dispose())
    };
  },
  {
    overlay: true,                       // render on top of existing UI
    overlayOptions: {
      width: "70%",                      // number or percentage string
      minWidth: 50,
      maxHeight: "80%",
      anchor: "center",                  // "center" | "top-left" | "top-center" | "right-center" | ...
      offsetX: 0, offsetY: 0,
      visible: (w, h) => w >= 80,       // responsive hide predicate
    },
    onHandle: (handle) => {
      // handle.focus() / handle.unfocus() / handle.setHidden(bool) / handle.hide()
    },
  }
);
```

**Rules:**
- Always use `theme` from the callback — never import theme directly
- Always type `DynamicBorder` color param: `(s: string) => theme.fg("accent", s)`, not `(s) =>`
- Call `tui.requestRender()` after every state change in `handleInput`
- Return `{ render, invalidate, handleInput }` — all three required

---

## Proven Picker Pattern (prompt-history.ts / inline-plan.ts)

The canonical reusable pattern for any list selection UI. Use this verbatim, adapt as needed.

```typescript
const selected = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  let query = "";
  let filtered = [...allItems];
  let cursor = 0;
  let cachedLines: string[] | undefined;

  function applyFilter(): void {
    const q = query.toLowerCase();
    filtered = q ? allItems.filter(item => item.label.toLowerCase().includes(q)) : [...allItems];
    cursor = 0;
    cachedLines = undefined;
  }

  function refresh(): void { cachedLines = undefined; tui.requestRender(); }

  function handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) { done(null); return; }
    if (matchesKey(data, Key.enter)) { if (filtered[cursor]) done(filtered[cursor].value); return; }
    if (data === "j" || matchesKey(data, Key.down)) { cursor = Math.min(cursor + 1, filtered.length - 1); refresh(); return; }
    if (data === "k" || matchesKey(data, Key.up)) { cursor = Math.max(cursor - 1, 0); refresh(); return; }
    if (matchesKey(data, Key.backspace)) { query = query.slice(0, -1); applyFilter(); refresh(); return; }
    if (data === "\x15") { query = ""; applyFilter(); refresh(); return; }  // ctrl+u clear
    if (data.length === 1 && data >= " ") { query += data; applyFilter(); refresh(); }
  }

  function render(width: number): string[] {
    if (cachedLines) return cachedLines;
    const lines: string[] = [];
    const add = (s: string) => lines.push(truncateToWidth(s, width));

    add(theme.fg("border", "─".repeat(width)));
    add(theme.fg("accent", " My Picker"));
    const qDisplay = query ? theme.fg("accent", query) + theme.fg("dim", "▌") : theme.fg("dim", "type to filter…");
    add(` / ${qDisplay}`);
    add("");

    const VISIBLE = 15;
    const half = Math.floor(VISIBLE / 2);
    const start = Math.max(0, Math.min(cursor - half, filtered.length - VISIBLE));
    const end = Math.min(filtered.length, start + VISIBLE);

    for (let i = start; i < end; i++) {
      const item = filtered[i];
      const isSel = i === cursor;
      const arrow = isSel ? theme.fg("accent", "▸") : " ";
      const label = truncateToWidth(item.label, width - 4);
      add(` ${arrow} ${isSel ? theme.fg("accent", label) : label}`);
    }
    if (filtered.length > VISIBLE) add(theme.fg("dim", `  ${cursor + 1} / ${filtered.length}`));

    add("");
    add(theme.fg("dim", " j/k navigate  •  type to filter  •  enter select  •  esc cancel"));
    add(theme.fg("border", "─".repeat(width)));
    cachedLines = lines;
    return lines;
  }

  return { render, invalidate: () => { cachedLines = undefined; }, handleInput };
});
```

---

## SelectList + DynamicBorder (canonical overlay pattern from tui.md)

For simple pickers that don't need type-to-filter — use `SelectList` + `DynamicBorder` from the docs:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const items: SelectItem[] = [
    { value: "opt1", label: "Option 1", description: "First option" },
    { value: "opt2", label: "Option 2" },
  ];
  const container = new Container();
  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
  container.addChild(new Text(theme.fg("accent", theme.bold("Pick an Option")), 1, 0));

  const selectList = new SelectList(items, Math.min(items.length, 10), {
    selectedPrefix: (t: string) => theme.fg("accent", t),
    selectedText: (t: string) => theme.fg("accent", t),
    description: (t: string) => theme.fg("muted", t),
    scrollInfo: (t: string) => theme.fg("dim", t),
    noMatch: (t: string) => theme.fg("warning", t),
  });
  selectList.onSelect = (item: SelectItem) => done(item.value);
  selectList.onCancel = () => done(null);
  container.addChild(selectList);
  container.addChild(new Text(theme.fg("dim", "j/k navigate • l/enter select • esc cancel"), 1, 0));
  container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

  return {
    render: (w: number) => container.render(w),
    invalidate: () => container.invalidate(),
    handleInput: (data: string) => {
      if (data === "j") selectList.handleInput("\x1b[B");
      else if (data === "k") selectList.handleInput("\x1b[A");
      else if (data === "l") selectList.handleInput("\r");
      else selectList.handleInput(data);
      tui.requestRender();
    },
  };
});
```

---

## Key Handling

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

// Key constants
Key.enter, Key.escape, Key.tab, Key.space, Key.backspace, Key.delete
Key.up, Key.down, Key.left, Key.right
Key.home, Key.end
Key.ctrl("c"), Key.shift("tab"), Key.alt("p"), Key.ctrlShift("p")

// String format also works:
matchesKey(data, "alt+p")
matchesKey(data, "ctrl+shift+p")

// Compound patterns from existing extensions:
if (/^\d$/.test(data)) { countBuffer += data; return; }  // count prefix accumulation
if (data === "g") {                                         // gg → top
  if (pendingG) { scrollTop(); pendingG = false; }
  else { pendingG = true; }
  return;
}

// Arrow escape codes for forwarding to SelectList:
"\x1b[B"  // down
"\x1b[A"  // up
"\r"      // enter / select
```

---

## Theme API

```typescript
// Always use theme from the custom() callback, not a global import
theme.fg("accent", text)          // foreground color
theme.fg("muted", text)
theme.fg("dim", text)
theme.fg("border", text)
theme.fg("success", text)
theme.fg("error", text)
theme.fg("warning", text)
theme.fg("toolTitle", text)
theme.bg("selectedBg", text)      // background
theme.bold(text)

// For Markdown rendering:
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
const mdTheme = getMarkdownTheme();
const md = new Markdown(markdownString, 0, 0, mdTheme);
// Recreate on invalidate() — theme may have changed
```

---

## Built-in Components — Constructor Signatures

```typescript
// Text: multi-line text with word wrap
new Text(content: string, paddingX: number, paddingY: number, bgFn?: (s:string)=>string)
text.setText("updated");

// Box: container with padding + background
new Box(paddingX: number, paddingY: number, bgFn: (s:string)=>string)
box.addChild(component); box.setBgFn(fn);

// Container: vertical stack
new Container()
container.addChild(component); container.removeChild(component);

// Spacer: empty vertical space
new Spacer(lines: number)

// Markdown
new Markdown(text: string, paddingX: number, paddingY: number, theme: MarkdownTheme)
md.setText("updated markdown");

// Editor: multi-line text input
const editor = new Editor(tui, editorTheme);
editor.onSubmit = (value: string) => { /* handle submit */ };
editor.setText("initial text");
editor.handleInput(data);
for (const line of editor.render(width)) add(line);
editor.dispose();  // call in dispose() of the parent component

// SelectList
new SelectList(items: SelectItem[], visibleRows: number, theme: SelectListTheme)
selectList.onSelect = (item: SelectItem) => {};
selectList.onCancel = () => {};
selectList.handleInput(data);
for (const line of selectList.render(width)) add(line);

// BorderedLoader: spinner + cancel
new BorderedLoader(tui, theme, "Loading message...")
loader.onAbort = () => done(null);
loader.signal  // AbortSignal to pass to async work

// SettingsList
new SettingsList(items, visibleRows, theme, onChange, onClose, { enableSearch? })
```

**EditorTheme shape (as used in inline-plan.ts and ask-user.ts):**
```typescript
const editorTheme: EditorTheme = {
  borderColor: (s: string) => theme.fg("accent", s),
  selectList: {
    selectedPrefix: (t: string) => theme.fg("accent", t),
    selectedText: (t: string) => theme.fg("accent", t),
    description: (t: string) => theme.fg("muted", t),
    scrollInfo: (t: string) => theme.fg("dim", t),
    noMatch: (t: string) => theme.fg("warning", t),
  },
};
```

---

## Caching Pattern

Cache rendered lines keyed by width to avoid recomputing on every frame:

```typescript
let cachedLines: string[] | undefined;
let cachedWidth = 0;

function render(width: number): string[] {
  if (cachedLines && cachedWidth === width) return cachedLines;
  cachedWidth = width;
  // ... build lines ...
  cachedLines = lines;
  return lines;
}

function invalidate(): void {
  cachedLines = undefined;
  cachedWidth = 0;
}
```

Call `invalidate()` whenever state changes (in `handleInput`), then `tui.requestRender()`.

---

## Line Width Utilities

```typescript
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

visibleWidth(str)                       // display width ignoring ANSI codes
truncateToWidth(str, width)             // truncate with optional "..."
truncateToWidth(str, width, "")         // truncate with no ellipsis

// Every line from render() must not exceed width — always truncate:
const add = (s: string) => lines.push(truncateToWidth(s, width));
```

---

## Footer (ctx.ui.setFooter)

```typescript
ctx.ui.setFooter((tui, theme, footerData) => {
  const unsub = footerData.onBranchChange(() => tui.requestRender());
  return {
    dispose: unsub,
    invalidate() {},
    render(width: number): string[] {
      const branch = footerData.getGitBranch();    // string | null
      const statuses = footerData.getExtensionStatuses();  // ReadonlyMap<string, string>
      return [truncateToWidth(`${ctx.model?.id} | ${branch ?? "no-git"}`, width)];
    },
  };
});

ctx.ui.setFooter(undefined);  // restore default
```

See `context-ui.ts` for the full production example with token counts, pricing bar, and cost display.
