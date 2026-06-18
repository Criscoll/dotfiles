# pi Extension API Reference

## Registration Methods

```typescript
pi.on("event_name", async (event, ctx) => { /* handler */ });
pi.registerTool({ name, label, description, parameters, execute, renderCall?, renderResult? });
pi.registerCommand("name", { description, handler: async (args, ctx) => {} });
pi.registerShortcut("ctrl+x", { description, handler: async (ctx) => {} });
pi.registerFlag("flag-name", { description, type: "boolean", default: false });
pi.registerProvider("provider-id", { baseUrl, apiKey, api, models });
```

---

## Tool Definition Structure

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";  // use StringEnum, NOT Type.Union/Literal (Google API compat)
import { Text } from "@earendil-works/pi-tui";

pi.registerTool({
  name: "my_tool",             // snake_case
  label: "My Tool",            // display name
  description: "What it does (shown to LLM)",
  promptSnippet: "One-line entry for 'Available tools' section",
  promptGuidelines: [
    "Use my_tool when X — name the tool explicitly, not 'this tool'"
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),
    text: Type.Optional(Type.String()),
  }),

  // Optional: adapt old stored args before validation (for resumed sessions)
  prepareArguments(args) { return args; },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    // Stream progress
    onUpdate?.({ content: [{ type: "text", text: "Working..." }], details: {} });

    // Run subprocess
    const result = await pi.exec("some-cmd", ["--arg"], { signal });

    return {
      content: [{ type: "text", text: "Done" }],   // sent to LLM
      details: { data: result },                     // for rendering + state reconstruction
      // terminate: true,                            // skip follow-up LLM call after this batch
    };
  },

  // Optional: custom rendering in the chat
  renderCall(args, theme, _context) {
    return new Text(theme.fg("toolTitle", theme.bold("my_tool")) + " " + theme.fg("muted", args.action), 0, 0);
  },
  renderResult(result, { expanded }, theme, _context) {
    const details = result.details as Record<string, unknown>;
    return new Text(theme.fg("success", "✓ Done"), 0, 0);
  },
});
```

**Error signaling:** throw from `execute` to set `isError: true`. Returning never sets the error flag.

**File mutations:** wrap with `withFileMutationQueue(absolutePath, async () => { /* read-modify-write */ })` when your tool edits files (prevents race conditions with parallel built-in tool calls).

---

## Events

### Startup / Resource
| Event | Payload | Return |
|---|---|---|
| `session_start` | `{ reason: "startup" \| "reload" \| "new" \| "resume" \| "fork", previousSessionFile? }` | void |
| `session_shutdown` | `{ reason, targetSessionFile? }` | void |
| `resources_discover` | `{ cwd, reason }` | `{ skillPaths?, promptPaths?, themePaths? }` |
| `project_trust` | `{ cwd }` | `{ trusted: "yes" \| "no" \| "undecided", remember?: boolean }` |

### Agent Lifecycle
| Event | Payload | Return |
|---|---|---|
| `before_agent_start` | `{ prompt, systemPrompt, systemPromptOptions }` | `{ message?: { customType, content, display }, systemPrompt? }` |
| `agent_start` | `{}` | void |
| `agent_end` | `{ messages }` | void |
| `turn_start` | `{ turnIndex, timestamp }` | void |
| `turn_end` | `{ turnIndex, message, toolResults }` | void |

### Message
| Event | Payload | Return |
|---|---|---|
| `message_start` | `{ message }` | void |
| `message_update` | `{ message, assistantMessageEvent }` | void |
| `message_end` | `{ message }` | `{ message }` (same role) or void |

### Tool
| Event | Payload | Return |
|---|---|---|
| `tool_call` | `{ toolName, toolCallId, input (mutable) }` | `{ block: true, reason?: string }` or void |
| `tool_result` | `{ toolName, toolCallId, input, content, details, isError }` | `{ content?, details?, isError? }` or void |
| `tool_execution_start` | `{ toolCallId, toolName, args }` | void |
| `tool_execution_end` | `{ toolCallId, toolName, result, isError }` | void |

### Context / Input
| Event | Payload | Return |
|---|---|---|
| `context` | `{ messages }` | `{ messages }` (filtered/modified) |
| `input` | `{ text, images?, source, streamingBehavior? }` | `{ action: "continue" \| "transform" \| "handled", text? }` |
| `before_provider_request` | `{ payload }` | modified payload or void |

### Session Control
| Event | Notes |
|---|---|
| `session_before_switch` | Can return `{ cancel: true }` |
| `session_before_fork` | Can return `{ cancel: true }` |
| `session_before_compact` | Can return `{ cancel: true }` or provide custom compaction |
| `model_select` | `{ model, previousModel, source }` — notification only |

---

## ctx API (ExtensionContext)

```typescript
ctx.mode          // "tui" | "rpc" | "json" | "print"
ctx.hasUI         // true in TUI and RPC modes
ctx.cwd           // current working directory
ctx.model         // active model { id, name, provider, contextWindow, cost, input }
ctx.modelRegistry // .getAvailable(), .find(provider, id)
ctx.signal        // AbortSignal for current turn (undefined when idle)

// Session
ctx.sessionManager.getEntries()    // all entries
ctx.sessionManager.getBranch()     // current branch entries
ctx.sessionManager.getLeafId()     // current leaf entry ID
ctx.sessionManager.getSessionFile() // session file path

// Context usage
ctx.getContextUsage()              // { tokens } | undefined

// System prompt
ctx.getSystemPrompt()              // current system prompt string

// Control
ctx.isIdle()
ctx.abort()
ctx.shutdown()                     // graceful exit
ctx.compact({ customInstructions?, onComplete?, onError? })
ctx.isProjectTrusted()
```

### ctx.ui

```typescript
// Dialogs (require ctx.hasUI)
await ctx.ui.select("Title", ["opt1", "opt2"])          // → string | null
await ctx.ui.confirm("Title", "Are you sure?")           // → boolean
await ctx.ui.input("Title", "Placeholder")               // → string | null

// Notifications (fire-and-forget)
ctx.ui.notify("Message", "info" | "error" | "warning")
ctx.ui.setStatus("my-ext", "Status text")               // footer status
ctx.ui.setStatus("my-ext", undefined)                   // clear
ctx.ui.setWidget("my-ext", ["line1", "line2"])          // above editor
ctx.ui.setWidget("my-ext", ["line1"], { placement: "belowEditor" })
ctx.ui.setEditorText("text")                            // pre-fill editor
ctx.ui.setTitle("Window Title")

// Full custom TUI (TUI mode only)
const result = await ctx.ui.custom<T>((tui, theme, keybindings, done) => {
  return { render, handleInput, invalidate };
}, { overlay?: boolean, overlayOptions?: { width, minWidth, maxHeight, anchor, ... } });
```

---

## Message Injection

```typescript
// Custom message (not a user message)
pi.sendMessage({ customType: "my-ext", content: "text", display: true }, {
  deliverAs: "steer" | "followUp" | "nextTurn",
  triggerTurn: true,
});

// User message (triggers LLM turn)
pi.sendUserMessage("text");
pi.sendUserMessage("text", { deliverAs: "steer" | "followUp" });  // when streaming

// Append extension entry to session (no LLM context)
pi.appendEntry("my-state", { key: "value" });
```

---

## Active Tools

```typescript
pi.getActiveTools()            // currently active tools
pi.getAllTools()                // all registered tools
pi.setActiveTools(["read", "bash"])  // restrict to named tools (plan mode pattern)

// Save/restore pattern (inline-plan.ts):
const savedTools = toolNames(pi.getActiveTools());
pi.setActiveTools(PLAN_MODE_TOOLS);
// ...later:
pi.setActiveTools(savedTools);
```

---

## State Management

**Simple: store in custom entries (not in LLM context):**
```typescript
pi.appendEntry("my-state", { enabled: true, goal: "xyz" });

pi.on("session_start", async (_event, ctx) => {
  const entry = ctx.sessionManager.getEntries()
    .filter(e => e.type === "custom" && e.customType === "my-state")
    .pop() as { data?: { enabled?: boolean } } | undefined;
  if (entry?.data) { /* restore */ }
});
```

**Branch-aware: reconstruct from tool result details:**
```typescript
pi.on("session_start", async (_event, ctx) => {
  items = [];
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "toolResult") {
      if (entry.message.toolName === "my_tool") {
        items = entry.message.details?.items ?? [];
      }
    }
  }
});
// In execute(): return { content: [...], details: { items: [...items] } }
```

---

## ExtensionCommandContext (extra methods in commands only)

```typescript
await ctx.waitForIdle()
await ctx.newSession({ withSession: async (ctx) => { await ctx.sendUserMessage("..."); } })
await ctx.fork(entryId, { position: "before" | "at", withSession })
await ctx.navigateTree(targetId, { summarize, customInstructions, label })
await ctx.switchSession(sessionPath, { withSession })
await ctx.reload()
ctx.getSystemPromptOptions()
```

**Footgun:** Inside `withSession`, use only the new `ctx` passed to the callback — captured old `pi` and `ctx` are stale after session replacement.
