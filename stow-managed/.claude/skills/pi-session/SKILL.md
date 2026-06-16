---
name: pi-session
description: Analyse pi coding agent session exports (.html files) — provides standard decode pattern, complete data schema, and ready-to-run query snippets so no exploratory poking is needed. Use when the user shares a pi session HTML file, asks to analyse a pi session, mentions "pi session", "session export", "pi-session-*.html", or wants to inspect tool calls, token usage, costs, conversation structure, or tool outputs from a pi session.
disable-model-invocation: false
---

# Pi Session Analysis

Pi exports sessions as self-contained HTML files. All data is embedded as base64-encoded JSON in a `<script id="session-data">` element. **Never grep the HTML as plain text** — decode it first with the snippet below.

## Standard Decode

Replace `SESSION.html` with the actual path.

```bash
python3 - <<'EOF'
import base64, json, re

with open("SESSION.html") as f:
    html = f.read()

m = re.search(r'id="session-data"[^>]*>(.*?)</script>', html, re.DOTALL)
data = json.loads(base64.b64decode(m.group(1).strip()).decode("utf-8"))
entries = data["entries"]

print(f"Session: {data['header']['id']}")
print(f"CWD:     {data['header']['cwd']}")
print(f"Start:   {data['header']['timestamp']}")
print(f"Entries: {len(entries)} ({', '.join(f'{v} {k}' for k, v in __import__('collections').Counter(e['type'] for e in entries).items())})")
EOF
```

To get the full JSON for further piping:

```bash
python3 -c "
import base64, json, re, sys
h = open(sys.argv[1]).read()
m = re.search(r'id=\"session-data\"[^>]*>(.*?)</script>', h, re.DOTALL)
print(json.dumps(json.loads(base64.b64decode(m.group(1).strip()).decode('utf-8'))))
" SESSION.html | jq '...'
```

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
      { "type": "toolCall", "id": "call_abc123", "name": "web_search", "arguments": { "query": "..." } },
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

### `message` — toolResult

**Critical:** `toolResult` is its own `role` — it is **not nested inside the assistant message**. Match to tool calls via `toolCallId`.

```json
{ "type": "message", "id": "...", "parentId": "...", "timestamp": "...",
  "message": {
    "role": "toolResult",
    "content": [{
      "type": "toolResult",
      "toolCallId": "call_abc123",
      "content": [{ "type": "text", "text": "tool output text" }]
    }]
  }
}
```

---

## Common Query Snippets

All assume `entries` is already decoded. Prepend the standard decode and adjust `SESSION.html`.

### All tool calls

```python
for e in entries:
    if e["type"] != "message": continue
    for part in e["message"].get("content", []):
        if isinstance(part, dict) and part.get("type") == "toolCall":
            print(part["name"], json.dumps(part["arguments"]))
```

### Tool calls paired with their results

```python
# Build call-id → name lookup from assistant messages
call_index = {}
for e in entries:
    if e["type"] != "message": continue
    for part in e["message"].get("content", []):
        if isinstance(part, dict) and part.get("type") == "toolCall":
            call_index[part["id"]] = (part["name"], part["arguments"])

# Iterate tool result messages
for e in entries:
    if e["type"] != "message": continue
    if e["message"].get("role") != "toolResult": continue
    for part in e["message"].get("content", []):
        if not isinstance(part, dict) or part.get("type") != "toolResult": continue
        name, args = call_index.get(part["toolCallId"], ("?", {}))
        text = " ".join(i.get("text", "") for i in part.get("content", []))
        print(f"[{name}] args={json.dumps(args)}")
        print(f"  result: {text[:300]}")
        print()
```

### Token and cost summary

```python
total_in = total_out = total_cost = 0
for e in entries:
    if e["type"] != "message": continue
    u = e["message"].get("usage")
    if not u: continue
    total_in   += u.get("input", 0)
    total_out  += u.get("output", 0)
    total_cost += u.get("cost", {}).get("total", 0)
print(f"Tokens: ↑{total_in:,}  ↓{total_out:,}    Cost: ${total_cost:.4f}")
```

### Conversation turns (user prompts only)

```python
for e in entries:
    if e["type"] != "message": continue
    if e["message"].get("role") != "user": continue
    for part in e["message"].get("content", []):
        if part.get("type") == "text":
            print(f"USER: {part['text'][:120]}")
```

### All models used across the session

```python
for e in entries:
    if e["type"] == "model_change":
        print(f"{e['timestamp']}  {e['provider']}/{e['modelId']}")
```

---

## Gotchas

- **`onUpdate` streaming content is ephemeral.** Custom tool extensions call `onUpdate` to stream progress during execution — this is visible in the live TUI but **not stored** in the session JSON. Only the final `return` content appears in `toolResult`.
- **Tool results are never inside assistant messages.** They always appear as separate `role: "toolResult"` messages. Matching is always by `toolCallId`.
- **Parallel tool calls** from a single assistant turn each get their own `toolResult` message; they can appear in any order.
- **Branch navigation:** entries with `parentId` not on the main branch belong to forks/clones. Filter to the main branch by walking from `leafId` back through `parentId` links if you only want the primary conversation path.
