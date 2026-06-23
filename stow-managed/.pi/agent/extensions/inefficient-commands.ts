/**
 * Inefficient Command Deny
 *
 * Delegates all rule logic to the shared shell script
 * ~/bin/agent_scripts/check-inefficient-command.sh so that Claude Code hooks
 * and pi extensions stay in sync from a single source of truth.
 */

import { withHookLogging } from "./lib/hook-logger";
import { execFileSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function resolveHome(p: string): string {
  if (p.startsWith("~/")) {
    return process.env.HOME + p.slice(1);
  }
  return p;
}

const scriptPath = resolveHome("~/bin/agent_scripts/check-inefficient-command.sh");

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", withHookLogging("inefficient-commands", "tool_call", async (event, ctx) => {
    if (event.toolName === "grep") {
      return {
        block: true,
        reason: "grep is slow and does not respect .gitignore. Use rg instead via bash: rg <pattern> [path]",
      };
    }
    if (event.toolName === "find") {
      return {
        block: true,
        reason: "find is slow. Use fd instead via bash: fd <pattern> [path]",
      };
    }

    if (event.toolName !== "bash") return;

    const command = event.input.command as string;

    const suggestion = execFileSync(scriptPath, [command], {
      encoding: "utf8",
      timeout: 5_000,
    }).trim();
    if (!suggestion) return;

    return { block: true, reason: suggestion };
  }));
}