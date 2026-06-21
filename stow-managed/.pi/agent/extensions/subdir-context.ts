/**
 * Subdir Context — Pi extension
 *
 * Mirrors Claude Code's lazy subdirectory CLAUDE.md loading: when pi first
 * touches a file inside a subdirectory that has an AGENTS.md (or CLAUDE.md),
 * injects that file's content into the tool result so the LLM sees it
 * alongside the file it just read/wrote.
 *
 * Only searches *below* CWD — files at or above CWD are already loaded by
 * pi's native startup walk. Each AGENTS.md is injected at most once per
 * session; the Set resets when the pi process exits.
 */

import { withHookLogging } from "./lib/hook-logger";
import { readFile } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const injected = new Set<string>();

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", withHookLogging("subdir-context", "tool_result", async (event, ctx) => {
    if (!["read", "edit", "write"].includes(event.toolName)) return;

    const filePath = (event.input as Record<string, unknown>)?.path as string | undefined;
    if (!filePath) return;

    const absFile = resolve(ctx.cwd, filePath);
    const found = await findAgentsMd(absFile, ctx.cwd);
    if (!found || injected.has(found.path)) return;

    injected.add(found.path);
    const label = relative(ctx.cwd, found.path);

    return {
      content: [
        { type: "text" as const, text: `[${label}]\n\n${found.content}` },
        ...(event.content ?? []),
      ],
      details: event.details,
      isError: event.isError,
    };
  }));
}

async function findAgentsMd(
  absFile: string,
  cwd: string,
): Promise<{ path: string; content: string } | null> {
  const NAMES = ["AGENTS.md", "CLAUDE.md"];
  // normalize: resolve() strips any trailing slash
  const normalCwd = resolve(cwd);
  let dir = dirname(absFile);
  // Only search strictly inside CWD — startsWith(normalCwd + "/") excludes
  // CWD itself and sibling directories like /repo2 when CWD is /repo.
  while (dir.startsWith(normalCwd + "/")) {
    for (const name of NAMES) {
      const candidate = resolve(dir, name);
      try {
        const content = await readFile(candidate, "utf-8");
        return { path: candidate, content };
      } catch {
        // not found at this level; keep walking up
      }
    }
    dir = dirname(dir);
  }
  return null;
}
