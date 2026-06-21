/**
 * GWS Guard — deny-by-default guard for gws-cli invocations.
 *
 * ALL direct gws-cli calls are blocked. Use wrapper scripts in ~/bin/agent_scripts/ instead.
 * Non-gws commands pass through without intervention.
 */

import { withHookLogging } from "./lib/hook-logger";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";


function isGwsToken(word: string): boolean {
  return (
    word === "gws" ||
    word === "gws-cli" ||
    word === "gws_cli" ||
    /^gws-cli@/.test(word)
  );
}

/**
 * Check a single shell segment (already split on &&/||/;/|).
 * Returns a denial reason string if the segment should be blocked, or null to allow.
 */
function checkSegment(seg: string): string | null {
  const words = seg.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return null;

  let gwsPos = -1;
  let i = 0;

  // Locate the gws-family invocation token, skipping env-var prefixes and launchers.
  while (i < words.length) {
    const w = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || w === "env" || w === "exec") {
      i++;
      continue;
    }
    if (w === "uvx") {
      i++;
      continue;
    }
    if (w === "python" || w === "python3") {
      if (
        i + 2 < words.length &&
        words[i + 1] === "-m" &&
        isGwsToken(words[i + 2])
      ) {
        gwsPos = i + 2;
        break;
      }
      // python without -m gws pattern — not a gws invocation
      return null;
    }
    if (isGwsToken(w)) {
      gwsPos = i;
      break;
    }
    // First meaningful word is not a gws token — not a gws segment
    return null;
  }

  if (gwsPos === -1) return null; // no gws token found

  // gws token found. Check for --help exemption only.
  for (let j = gwsPos + 1; j < words.length; j++) {
    if (words[j] === "--help" || words[j] === "-h" || words[j] === "help") return null;
  }

  return "Direct gws-cli calls are not allowed. Use the wrapper scripts in ~/bin/agent_scripts/ instead (gmail-list, gmail-search, gmail-read, gmail-labels, gmail-get-metadata, etc.). If no wrapper covers your need: state what you need, confirm no existing wrapper covers it, then ask the user to add a new wrapper script — do not call gws-cli directly.";
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", withHookLogging("gws-guard", "tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = event.input.command as string;
    if (!command) return;

    // Credential-file deny rule (req 7)
    if (/gws-cli\/[^ ]*\.enc/.test(command)) {
      const reason =
        "Credential access blocked: gws-cli token/secret files may not be read, copied, or referenced.";
      if (!ctx.hasUI) return { block: true, reason };
      return { block: true, reason };
    }

    // Split on shell chaining operators; check every segment containing a gws token
    const segments = command.split(/&&|\|\||;|\|/);
    for (const seg of segments) {
      const reason = checkSegment(seg);
      if (reason !== null) {
        if (!ctx.hasUI) return { block: true, reason };
        return { block: true, reason };
      }
    }
  }));
}
