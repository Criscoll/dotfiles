/**
 * Lint-on-Edit — Pi extension
 *
 * Hooks tool_result for write/edit tools and runs lint-file.sh on the target
 * file. If the linter produces output (indicating issues were fixed or remain),
 * prepends it to the tool result content so the LLM sees it and self-corrects.
 *
 * Delegates all language-to-linter mapping to the shared dispatch script
 * at ~/bin/agent_scripts/lint-file.sh — adding a new language requires
 * only a new case arm there; this extension needs no changes.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);

const LINT_SCRIPT = "~/bin/agent_scripts/lint-file.sh";

/** Resolve ~ to the home directory. */
function resolveHome(p: string): string {
  if (p.startsWith("~/")) {
    return process.env.HOME + p.slice(1);
  }
  return p;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const filePath: string | undefined = (event.input as Record<string, unknown>)?.path as string | undefined;
    if (!filePath) return;

    const scriptPath = resolveHome(LINT_SCRIPT);

    try {
      const { stdout, stderr } = await execFileAsync(scriptPath, [filePath], {
        timeout: 30_000,
      });
      const output = (stdout + stderr).trim();
      if (!output) return; // Nothing to report

      // Prepend lint output to the existing content so the LLM sees it
      const lintBlock = {
        type: "text" as const,
        text: `[lint-file.sh] ${output}`,
      };

      return {
        content: [lintBlock, ...(event.content ?? [])],
        details: event.details,
        isError: event.isError,
      };
    } catch {
      // Script failed silently (tool missing, file gone, etc.) — ignore
    }
  });
}