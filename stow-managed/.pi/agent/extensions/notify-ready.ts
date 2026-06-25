/**
 * Ready Notification
 *
 * Delegates tmux + desktop notification to notify-core.sh (shared with Claude Code hook).
 * OSC 777/99 terminal escape sequences serve as fallback when no desktop notifier is available.
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

export default function (pi: ExtensionAPI) {
  pi.on("agent_end", withHookLogging("notify-ready", "agent_end", async () => {
    const coreScript = `${process.env.HOME}/.claude/hooks/notify-core.sh`;
    const res = await pi.exec("sh", [coreScript, "Pi"], { timeout: 8000 });

    // exit 1 means no desktop notifier — fall back to terminal escape sequences
    if (res.code !== 0) {
      if (process.env.KITTY_WINDOW_ID) {
        notifyOSC99("Pi", "Ready for input");
      } else {
        notifyOSC777("Pi", "Ready for input");
      }
    }
  }));
}
