# Remote Agentic Coding Manager — Requirements and Evaluation Criteria

Compiled 2026-09-28 from my own commit history in paseo (69 commits, 2026-07 to 2026-09).
Every criterion below is something I personally built or hardened because a tool
without it didn't survive real use. Use this as the checklist when comparing
paseo against any alternative (Conductor, Vibe Kanban, Crystal, Terragon,
omnara, etc.): a candidate is only viable if it clears the *principles* section
and makes real progress on the five capability fronts.

Paseo commit references are included as provenance — each one shows the
requirement was real enough that I hit it in practice, not hypothetical.

---

## Core premise

The manager connects directly to my actual dev environment — my code stays on
my machine — and I reach it from **any device**: desktop app, phone, plain
browser, PWA. Sessions and their surrounding state must follow *me*, not the
device I'm holding. Everything below exists in service of that.

---

## The five capability fronts

### 1. Multi-device session access

The tool is worthless if state is per-device or if the phone browser is a
second-class citizen.

- **Server-side view state, not per-device preferences.** Parking work out of
  the sidebar ("snooze") is daemon state so it follows phone → browser →
  desktop. Any alternative that keeps view state in localStorage fails here.
  (paseo: `e45cca111`, `4aa6381d8`)
- **Attention/read state as cross-device session flags** — "mark as unread"
  so triage marks made on the phone are visible on desktop. (`64570864b`)
- **Cross-agent, host-owned prompt history.** Every prompt ever sent is
  searchable from any client; deduped globally by exact text; the agent's very
  first prompt must not be silently dropped. (`7c6c9d35c`, `7a200a4d9`,
  `998388bc4`)
- **Live dev-server preview on every platform** — an in-app browser pane that
  works on web/PWA/native, not just the desktop wrapper, with a
  viewport-width toggle so I can check the desktop layout from my phone.
  (`dec32a68c`)
- **Compact parity for the whole toolkit** — Files, finder, command center,
  copy/open actions all usable at phone width. (`aab97b2dc`, `4c2090942`,
  `fdb832b8e`)
- **Mobile-web actually works.** On-screen keyboard vs composer/terminal
  focus, touch-drag scrolling inside gesture sheets, hover-only affordances on
  touch. A remote manager lives or dies on the phone browser. (`ca40e1d69`,
  `06f1ee0a4`, `47a983628`, `87b00331f`, `e5b948758`)

### 2. Desktop, vim-like navigation

Full keyboard-driven operation, built with the discipline of a real editor —
no feature ships if it forces a mouse round-trip mid-conversation.

- **Bare-key bindings scoped to the focused surface** (sidebar focus scope),
  so Escape in the list can never kill the running agent. Count prefixes, and
  shortcut resolution order that is load-bearing and test-pinned.
  (`e808208e1`)
- **Keyboard cursor over lists**: j/k with count, gg/G, Enter, s to snooze, z
  to collapse, Tab to cycle filters; cursor addressed by row identity so list
  churn can't strand it. (`4487b742c`)
- **`/` search that highlights in place, never filters**, with n/N stepping
  matches as a ring. (`c782ce5a3`)
- **`n` jumps to the last workspace** via a two-slot MRU — rapid session
  flipping is the point. (`d1d8a6616`)
- **Command palette (Cmd/Ctrl+K) with j/k navigation** and ready/wip/done
  grouping. (`de5b8d144`)
- **Telescope-style file finder as a global Cmd/Ctrl+P overlay** — streaming
  filename + content search, token-stacking query syntax. (`4c06d3291`,
  `a2950c1bb`, `61226f4d4`)
- **Composer keyboard shortcuts** — prompt-history toggle, thinking-level
  cycle, question-form arrow-key nav — all auto-documented in a shortcuts
  dialog and user-rebindable. (`d58b7d71f`)

### 3. Host-side file and repo tooling (the swiss army knife)

The manager must be a host-side IDE companion, not just a chat viewer.

- **Browse and view any host directory without opening a workspace or
  starting an agent.** (`ed7e283a0`)
- **Inline file editing that writes back to the host** — revision-based
  conflict detection, atomic writes, unsaved-discard guards everywhere.
  (`5b3984320`, `9332c0a0d`, `e379d9d87`)
- **Git log browsing in-app** — read-only commit history with expand-to-diff,
  grab a hash to hand to an agent. (`8ef383fcc`)
- **Cross-linked file surfaces** — finder → tree reveal, diff → open file,
  open file → reveal location, jump-to-selected in the tree. Nothing is an
  island. (`b669372e6`, `4bb1a00bb`, `e022e56d4`, `8db613794`)
- **Composer-embedded search** — filesystem search with fuzzy/`!`/`'` token
  syntax, alongside prompt-history search. (`03a287564`, `7c6c9d35c`)
- **Copy affordances everywhere** — and they must actually work: plain-HTTP
  LAN origins and Modal focus traps silently break clipboard on web.
  (`1837e8f95`, `a8cd116bf`, `7d2226839`, `d6eff2f39`)

### 4. Agent-workflow ergonomics

- **Plan approval with "Implement & Clear Context"** — seed the fresh turn
  with only the approved plan, not the whole planning transcript, with a
  visible context-divider in the timeline. (`64b34878f`, `e389985b6`)
- **Model switch at plan approval** — plan with a strong-reasoning model,
  implement with a cheap one. The tool should make this a one-pick action,
  and the model change must actually broadcast to clients. (`262928340`,
  `a32d65a6e`)
- **Rich subagent detail** — narration, tool inputs *and* results in the
  Task/subagent bubble, not just bracketed tool names. (`576c4ccd2`)
- **Triage at a glance** — ready/wip/done grouping shared across surfaces,
  per-row working-time counters, live filter-tab counts. (`de5b8d144`,
  `edd3f10b6`, `4aa6381d8`)

### 5. Robustness and observability

- **Instrument before guessing.** On-device-only bugs can't be reproduced in
  devtools; the client→daemon diagnostic breadcrumb channel is permanent
  infrastructure, not a one-off hack. (`6aebf6823`, `3755e7370`)
- **Provider drift must degrade, not crash.** An upstream agent changing its
  stream shape crashed the whole daemon; a manager supervising many agents
  must never die because one provider moved. (`b2d5086b1`)
- **Model manifests track upstream reality** — probed from the binary, not
  guessed, and troubleshooting docs for "works in my terminal but not under
  the daemon" auth failures. (`d7d659b08`, `dedc44764`)
- **Security docs cover real deployment topology** — e.g. Origin vs Host
  allowlisting when dialing via Tailscale MagicDNS names. (`0be06311f`)

---

## Principles (how it should be built — judge alternatives on these too)

1. **Server-side view state over per-device preferences** whenever the state
   should follow the user.
2. **Keyboard parity is a requirement**, not a nicety.
3. **Touch parity is a requirement** — every hover-only affordance needs a
   compact/tap path.
4. **Capability-gated features, no fallback paths** — old daemons show
   "update the host", never a degraded shim; capability flags live in
   `server_info.features.*`.
5. **Protocol backward-compat always** — new fields optional, wire schemas
   purely structural, old clients keep parsing.
6. **Instrument hard-to-reproduce bugs** rather than shipping blind fixes.
7. **Reuse over rebuild** — extend the existing primitive so surfaces can't
   drift (shared classifiers, shared diff viewers, shared label resolvers).

---

## Evaluation shortcut

When assessing an alternative, ask in order:

1. Can I reach my sessions from phone, browser, and desktop with the *same*
   state (triage marks, parked work, history)?
2. Can I drive the entire thing from the keyboard, editor-style, without
   touching a mouse mid-conversation?
3. Can I browse/edit my code and read git history without leaving the tool?
4. Can I preview my dev server from my phone, scaled to check the desktop
   layout?
5. Does it survive upstream agent-provider changes without crashing, and can
   I debug on-device-only bugs from the daemon log?

Paseo clears all of the above as of 2026-09 (with the commit trail above as
receipts). Any candidate missing more than one of the five fronts is not a
replacement — at most a complement.

---

## Comparison log

### herdr — 2026-09-28

Source: [github.com/herdrdev/herdr](https://github.com/herdrdev/herdr) ·
[herdr.dev/docs](https://herdr.dev/docs) · v0.9.x, 40.9k stars, Apache-2.0, very active.

**Category:** different — a terminal multiplexer for agents (tmux successor on
libghostty, one Rust binary, no Electron). It *owns the terminals agents run
in*; it doesn't wrap or replace them. Supports 17+ agents with native session
resume commands.

| Front | Verdict | Notes |
|---|---|---|
| 1. Multi-device access | **Partial — fails core premise** | Session persistence is excellent (detach, layout restore, native agent resume, live handoff across upgrades). But "remote" = SSH from another terminal. No phone app, no web UI, no PWA, no dev-server preview. Third-party bridges possible via socket API (JSON `terminal.frame` observers) but nothing shipped. **Beats paseo on multi-machine span**: several SSH hosts in one window, combined agent list, independent reconnects — paseo is one host daemon. |
| 2. Keyboard | **Pass, different school** | Keyboard and mouse both first-class; tmux-style prefix keys (`ctrl+b`), not bare-key modal vim (no j/k/`/`/n/N layer). Mouse-first onboarding, rebindable. |
| 3. File/repo tooling | **Fail — by design** | No file browser, inline editing, git log, finder, or copy affordances. It's terminals; you run vim/git in panes. |
| 4. Agent-workflow ergonomics | **Strong, complementary** | *Agent-native*: agents drive herdr via CLI/socket API, spawn panes, prompt each other, wait until another is genuinely blocked. Pane working/blocked/idle attention. No plan-approval model switch, no cross-agent prompt history, no subagent detail. herdr = agent-to-agent orchestration; paseo = human-in-the-loop conversation ergonomics. |
| 5. Robustness | **Strong** | Reconnect backoff, SSH health probes, client/server version negotiation, capability-gated actions (same pattern as `server_info.features.*`), no secrets in machine catalog, huge community. |

**Verdict:** Complement, not replacement (misses fronts 1 and 3). Unusually
good complement because overlap is small — herdr covers terminal persistence,
multi-machine span, and agent-to-agent prompting; paseo covers phone/browser
access and host-side IDE tooling. Orthogonal halves of the same problem. The
"no Electron, one Rust binary" philosophy is genuinely appealing; if herdr (or
a bridge built on its socket API) ever ships a mobile/web client, re-evaluate.
