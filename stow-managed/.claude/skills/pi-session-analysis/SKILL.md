---
name: pi-session-analysis
description: >-
  Analyse pi coding agent session exports (.html files) — run utility scripts for
  token-efficient extraction of overview, tool calls, and conversation turns. Use
  when the user shares a pi session HTML file, asks to analyse a pi session, mentions
  "pi session", "session export", "pi-session-*.html", or wants to inspect tool
  calls, token usage, costs, conversation structure, or tool outputs from a pi session.
disable-model-invocation: false
---

# Pi Session Analysis

Pi exports sessions as self-contained HTML files. All data is embedded as base64-encoded JSON in a `<script id="session-data">` element. **Never grep the HTML as plain text** — use the scripts below.

## Utility Scripts

All scripts live in `~/bin/agent_scripts/`. Use them instead of writing inline Python — they handle the base64 decode and format differences so you don't have to re-derive them.

```bash
# Overview: session id, CWD, start time, model, entry counts, token/cost
~/bin/agent_scripts/pi-session-info SESSION.html

# All tool calls with their results (default: truncate results to 500 chars)
~/bin/agent_scripts/pi-session-tools SESSION.html
~/bin/agent_scripts/pi-session-tools --limit 2000 SESSION.html   # longer results
~/bin/agent_scripts/pi-session-tools --limit 0 SESSION.html      # no truncation

# User/assistant conversation turns only (tool calls and thinking omitted)
~/bin/agent_scripts/pi-session-chat SESSION.html
~/bin/agent_scripts/pi-session-chat --limit 0 SESSION.html       # no truncation

# Raw JSON to stdout — pipe to jq for ad-hoc queries
~/bin/agent_scripts/pi-session-decode SESSION.html | jq '...'
```

**Standard workflow:** run `pi-session-info` first for the overview, then `pi-session-tools` or `pi-session-chat` depending on what the user wants to investigate.

---

## Top-Level Schema

```
data
├── header           { type, version, id, timestamp, cwd }
├── entries[]        tree of session events (see Entry Types)
├── leafId           string — tip of the main branch
├── systemPrompt     string
├── tools[]          tool definitions available to the model
└── renderedTools    (internal rendering cache — skip)
```

Entries form a **tree** via `parentId`. `leafId` points to the last entry on the main branch. Forks/clones create sibling subtrees.

---

## Entry Types

### `model_change`
```json
{ "type": "model_change", "id": "...", "parentId": "...", "timestamp": "...",
  "provider": "openrouter", "modelId": "deepseek/deepseek-v4-flash" }
```

### `thinking_level_change`
```json
{ "type": "thinking_level_change", "id": "...", "parentId": "...", "timestamp": "...",
  "thinkingLevel": "high" }
```

### `message` — user
```json
{ "type": "message", "id": "...", "parentId": "...", "timestamp": "...",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "user input" }],
    "timestamp": 1234567890123
  }
}
```

### `message` — assistant
```json
{ "type": "message", "id": "...", "parentId": "...", "timestamp": "...",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "...", "thinkingSignature": "reasoning" },
      { "type": "toolCall", "id": "call_abc123", "name": "bash", "arguments": { "command": "..." } },
      { "type": "text", "text": "assistant reply" }
    ],
    "api": "openai-completions",
    "provider": "openrouter",
    "model": "deepseek/deepseek-v4-flash",
    "usage": {
      "input": 9121, "output": 98,
      "cacheRead": 0, "cacheWrite": 0, "totalTokens": 9219,
      "cost": { "input": 0.000896, "output": 0.0000193, "cacheRead": 0, "cacheWrite": 0, "total": 0.000916 }
    }
  }
}
```

Content parts on an assistant message can include any mix of: `thinking`, `toolCall`, `text`.

### `message` — toolResult (pi native format)

In pi's native format, `toolCallId` and `toolName` sit on the message directly; content is flat text:

```json
{ "type": "message", "id": "...", "parentId": "...", "timestamp": "...",
  "message": {
    "role": "toolResult",
    "toolCallId": "call_abc123",
    "toolName": "bash",
    "isError": false,
    "timestamp": 1234567890123,
    "content": [{ "type": "text", "text": "tool output" }]
  }
}
```

Match to tool calls by `toolCallId` ↔ the `id` field on the `toolCall` content part in the preceding assistant message.

---

## Ad-hoc jq Queries

Use `pi-session-decode` to get raw JSON, then pipe to jq:

```bash
# All tool names used
~/bin/agent_scripts/pi-session-decode SESSION.html | jq -r '
  .entries[] | select(.type=="message") |
  .message.content[]? | select(.type=="toolCall") | .name
' | sort | uniq -c | sort -rn

# Token usage per assistant turn
~/bin/agent_scripts/pi-session-decode SESSION.html | jq -r '
  .entries[] | select(.type=="message") |
  .message | select(.usage) |
  [.usage.input, .usage.output, .usage.cost.total] | @csv
'
```

---

## Gotchas

- **`onUpdate` streaming content is ephemeral.** Custom tool extensions call `onUpdate` to stream progress during execution — this is visible in the live TUI but **not stored** in the session JSON. Only the final `return` content appears in `toolResult`.
- **Two toolResult formats exist.** Pi's native format puts `toolCallId` on the message; the OpenAI/Claude format nests it inside a `content` part of type `toolResult`. The utility scripts handle both.
- **Parallel tool calls** from a single assistant turn each get their own `toolResult` message; they can appear in any order.
- **Branch navigation:** entries with `parentId` not on the main branch belong to forks/clones. Filter to the main branch by walking from `leafId` back through `parentId` links if you only want the primary conversation path.
