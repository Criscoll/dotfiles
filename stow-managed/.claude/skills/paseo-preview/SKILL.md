---
name: paseo-preview
description: >-
  Set up a project's dev server so its frontend can be viewed live through
  Paseo's in-app browser preview pane, when the agent is running inside a
  Paseo session (web browser, PWA, or Electron desktop) rather than a plain
  terminal. Auto-invoke BEFORE starting a dev server for preview purposes when
  the session is Paseo-hosted, or when the user wants to view a frontend
  through Paseo instead of opening a separate browser tab manually. Trigger
  phrases: "paseo web", "paseo preview", "browser view", "preview my app in
  paseo", "hot reload browser view", "open preview", "view this in paseo",
  "check the mobile layout from my phone", "live preview of the dev server".
disable-model-invocation: false
---

Paseo is a mobile/web app for monitoring and controlling local coding agent
sessions (repo: `~/Repos/paseo`, unless the user's environment says otherwise —
if that path doesn't exist, locate it before assuming any doc paths below are
valid). When a Claude Code (or pi) session is running *inside* a Paseo-hosted
terminal — web browser, PWA, or the Electron desktop wrapper — Paseo can proxy
a workspace's running dev server and show it live in an in-app browser pane,
so the user doesn't need to leave the session to check the frontend. This
skill is about getting the dev server side ready; opening the pane itself is
a UI action the user takes, not something the agent does.

## What to do

1. **Detect the project's dev command.** Don't hardcode a stack — read
   `package.json` (`scripts.dev`, `scripts.start`), or fall back to the
   project's README/CLAUDE.md, to find the actual command that starts the
   frontend dev server (e.g. `npm run dev`, `vite`, `next dev`).

2. **Check whether that command is already registered as a Paseo workspace
   script** for the current workspace, and whether it's currently running.
   If a script is already running and its port/URL matches the dev command,
   there's nothing to set up — tell the user it's ready to preview.

3. **If no script is registered, or it isn't running, start it** using the
   project's normal dev command, the same way you would for any other
   run-the-app task. Confirm it's actually listening (check the log output
   or port) before telling the user it's ready — a preview pane pointed at a
   dead server just shows a connection error, which looks like a Paseo bug
   rather than "the server hasn't started yet."

4. **Hand off to the user for the actual preview.** Once the server is up,
   tell the user to tap "Open preview" on that running script in the
   workspace scripts menu — that opens the live browser pane. The agent
   should not try to open the pane itself; it's a client-side UI action with
   no CLI or RPC equivalent exposed to the agent.

5. **If the user asks why this works over a plain `localhost` URL**, it's
   because Paseo proxies the dev server rather than exposing raw localhost —
   that's what makes it reachable from a phone, not just the same machine.
   Point them at `docs/service-proxy.md` in the Paseo repo (path above) for
   the DNS/reverse-proxy mechanics — don't re-explain those details here,
   they're liable to drift out of sync with this skill.

## Good to know, not to duplicate here

- The preview pane works across plain web browser, installed PWA, Electron
  desktop, and native phone app (native uses a real webview, not an iframe).
- It includes reload, open-in-new-tab, and a viewport-width device-preset
  toggle for checking how the frontend looks at phone/tablet widths — useful
  when the user says something like "check the mobile layout from my phone."
- For the full picture of how this pane was built (iframe on web, webview on
  Electron/native, why the iframe intentionally runs without a `sandbox`
  attribute), the source lives in `packages/app/src/components/browser-pane*`
  in the Paseo repo — read it directly if asked to modify Paseo itself,
  rather than treating this skill as documentation of Paseo's own code.
