/**
 * Inefficient Command Deny
 *
 * Port of .claude/hooks/catch-stupid-commands.sh
 * Denies inefficient command patterns with suggestions so the LLM
 * self-corrects without prompting the user.
 *
 * Patterns denied:
 *   - grep -r / --recursive → rg
 *   - useless cat | grep / cat | wc -l → direct file argument
 *   - find | xargs → fd --exec/-x
 *   - find -name / -iname → fd
 *   - find -type f/d → fd (skip when -perm/-user/-group used)
 *
 * Each rule checks that its required tool (rg, fd) is on $PATH
 * before denying. If the tool is absent, the command is allowed through.
 */

import { withHookLogging } from "./lib/hook-logger";
import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface Rule {
  pattern: RegExp;
  suggestion: string;
  /** If this regex matches the command, skip the rule (allow through). */
  exception: RegExp | null;
  /** Binary that must be on $PATH for the rule to apply. */
  requiredTool: string | null;
}

const rules: Rule[] = [
  // grep -r / -R / combined flags (e.g. -rn, -rl, -ri): ripgrep is faster and respects .gitignore
  {
    pattern: /grep\s+-[a-zA-Z]*[rR][a-zA-Z]*(?:\s|$)/,
    suggestion: "grep -r is slow and does not respect .gitignore. Use rg instead: rg <pattern> [path]",
    exception: null,
    requiredTool: "rg",
  },

  // grep --recursive (long form)
  {
    pattern: /grep\s+--recursive(?:\s|$)/,
    suggestion: "grep --recursive is slow and does not respect .gitignore. Use rg instead: rg <pattern> [path]",
    exception: null,
    requiredTool: "rg",
  },

  // useless use of cat piped to grep
  {
    pattern: /cat\s+[^|]+\|\s*grep\s/,
    suggestion: "Useless use of cat. Pass the file directly to grep: grep <pattern> <file>",
    exception: null,
    requiredTool: null,
  },

  // useless use of cat piped to wc -l
  {
    pattern: /cat\s+[^|]+\|\s*wc\s+-l/,
    suggestion: "Useless use of cat. Pass the file directly to wc: wc -l <file>",
    exception: null,
    requiredTool: null,
  },

  // find piped to xargs: fd --exec/-x is safer and more direct
  {
    pattern: /find\s+[^|]*\|\s*xargs(?:\s|$)/,
    suggestion: "find | xargs is inefficient. Use fd with --exec (-x): fd [pattern] [path] -t f -x <cmd> {}. The -x flag handles spaces in filenames and is safer than xargs.",
    exception: null,
    requiredTool: "fd",
  },

  // find -name / -iname for file searching: fd is faster
  {
    pattern: /find\s+.*-i?name\s/,
    suggestion: "find -name is verbose for file searches. Use fd instead: fd <pattern> [path]",
    exception: null,
    requiredTool: "fd",
  },

  // find -type f/d: use fd (exception for predicates fd cannot replicate)
  {
    pattern: /find\s+.*\s-type\s+[fd](?:\s|$)/,
    suggestion: "Use fd for type-based searches: fd -t f [path] or fd -t d [path]. fd also supports: --changed-after <file> (replaces -newer), --changed-within <duration> (replaces -mtime), --size <spec> (replaces -size). Only use find when filtering by -perm, -user, or -group.",
    exception: /find\s+.*-(?:perm|user|group)\s/,
    requiredTool: "fd",
  },
];

function isOnPath(binary: string): boolean {
  try {
    execSync(`command -v ${binary}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function checkCommand(command: string): { matched: boolean; suggestion: string } {
  for (const { pattern, suggestion, exception, requiredTool } of rules) {
    if (!pattern.test(command)) continue;

    // Skip if exception applies
    if (exception && exception.test(command)) continue;

    // Skip if required tool is not on $PATH
    if (requiredTool && !isOnPath(requiredTool)) continue;

    return { matched: true, suggestion };
  }

  return { matched: false, suggestion: "" };
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", withHookLogging("inefficient-commands", "tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = event.input.command as string;
    const { matched, suggestion } = checkCommand(command);
    if (!matched) return;

    return { block: true, reason: suggestion };
  }));
}