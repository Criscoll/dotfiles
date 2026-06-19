/**
 * GWS Guard — deny-by-default allow-list for gws-cli invocations.
 *
 * Permits only read+move (Gmail) and read+create+update (Calendar) subcommands.
 * Fails closed: if a segment mentions a gws token but the (service, subcommand)
 * pair cannot be confidently extracted, the command is denied.
 * Non-gws commands pass through without intervention.
 *
 * Allow-lists are kept byte-for-byte parallel to gws-guard.sh.
 */

import { withHookLogging } from "./lib/hook-logger";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Single source of truth — keep parallel to gws-guard.sh GMAIL_ALLOW
const GMAIL_ALLOW = new Set([
  "list", "read", "search", "labels", "get-label", "drafts", "get-draft",
  "threads", "get-thread", "list-attachments", "download-attachment",
  "get-vacation", "get-signature", "filters", "get-filter", "history",
  "add-labels", "remove-labels", "modify-thread-labels", "batch-modify",
  "mark-read", "mark-unread", "create-label",
]);

// Single source of truth — keep parallel to gws-guard.sh CALENDAR_ALLOW
const CALENDAR_ALLOW = new Set([
  "calendars", "list", "get", "instances", "attendees", "freebusy", "colors",
  "list-acl", "get-reminders", "get-default-reminders", "create", "update",
  "create-recurring", "quick-add", "add-attendees", "remove-attendees", "rsvp",
  "set-reminders", "set-default-reminders", "move-event",
]);

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

  // Find the service token (gmail / calendar), skipping flags
  let service = "";
  i = gwsPos + 1;
  while (i < words.length) {
    const w = words[i];
    if (w === "--help" || w === "-h" || w === "help") return null; // help is safe
    if (/^--[^=]+=/.test(w)) { i++; continue; } // --key=val
    if (/^--/.test(w)) { i += 2; continue; }     // --flag value
    if (/^-/.test(w)) { i++; continue; }          // -f
    if (w === "gmail" || w === "calendar") { service = w; break; }
    // Unexpected word before service — fail closed
    return `gws command blocked: could not locate a known service (gmail/calendar) near "${w}"`;
  }

  if (!service) return null; // bare gws/gws-cli with no service — safe (lists subcommands)

  // Find the subcommand: first bare word after the service, skipping flags
  let subcmd = "";
  i++;
  while (i < words.length) {
    const w = words[i];
    if (w === "help" || w === "--help" || w === "-h") return null; // help after service
    if (/^--[^=]+=/.test(w)) { i++; continue; }
    if (/^--/.test(w)) { i += 2; continue; }
    if (/^-/.test(w)) { i++; continue; }
    subcmd = w;
    break;
  }

  if (!subcmd) return null; // no subcommand — bare `gws gmail` lists subcommands, safe

  // Check (service, subcommand) against allow-list
  if (service === "gmail") {
    if (!GMAIL_ALLOW.has(subcmd)) {
      return `gws gmail '${subcmd}' is not on the allow-list. Only read+move Gmail commands are permitted. Denied subcommand: ${subcmd}`;
    }
  } else if (service === "calendar") {
    if (!CALENDAR_ALLOW.has(subcmd)) {
      return `gws calendar '${subcmd}' is not on the allow-list. Only read+create+update Calendar commands are permitted. Denied subcommand: ${subcmd}`;
    }
  }

  return null;
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
