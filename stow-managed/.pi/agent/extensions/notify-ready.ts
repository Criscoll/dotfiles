/**
 * Ready Notification
 *
 * Port of .claude/hooks/notify-ready.sh
 * Sends a desktop notification when pi finishes processing and is ready for input.
 *
 * Supports:
 *   - OSC 777: iTerm2, Ghostty, WezTerm, rxvt-unicode
 *   - OSC 99: Kitty
 */

import { withHookLogging } from "./lib/hook-logger";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function notifyOSC777(title: string, body: string): void {
  process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
  process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
  process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notify(title: string, body: string): void {
  if (process.env.KITTY_WINDOW_ID) {
    notifyOSC99(title, body);
  } else {
    // iTerm2, Ghostty, WezTerm, rxvt-unicode, and most modern terminals
    notifyOSC777(title, body);
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", withHookLogging("notify-ready", "agent_end", async () => {
    notify("Pi", "Ready for input");
  }));
}