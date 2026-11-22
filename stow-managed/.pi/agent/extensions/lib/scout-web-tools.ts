/**
 * scout-web-tools — read-only web tools for scout children.
 *
 * Loaded only by scout.ts via `pi --no-extensions -e <this file>`; it lives in
 * lib/ so pi's auto-discovery never loads it into the parent session. Web
 * scouts get these two tools and no shell, so "read-only" is enforced by the
 * tool list rather than by prompt.
 */

import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const WEBSEARCH = join(homedir(), "bin", "agent_scripts", "websearch");
const WEBCRAWL = join(homedir(), "bin", "webcrawl");
const MAX_OUTPUT = 20_000;
const SNIPPET_CAP = 1_500;
const TIMEOUT_MS = 90_000;

function run(cmd: string, args: string[], signal: AbortSignal | undefined): Promise<{ out: string; err: string; code: number }> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024, signal },
      (error, stdout, stderr) => {
        const code = error && typeof (error as { code?: unknown }).code === "number" ? (error as { code: number }).code : error ? 1 : 0;
        resolve({ out: stdout, err: stderr, code });
      },
    );
  });
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n[truncated ${text.length - max} chars]` : text;
}

interface SearchResult {
  title?: string;
  url?: string;
  snippet?: string;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web (Brave). Returns titles, URLs and extracted page content. " +
      "Use web_fetch to read a promising URL in full.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      count: Type.Optional(Type.Number({ description: "Max results (default 6, max 10)" })),
      freshness: Type.Optional(
        StringEnum(["day", "week", "month", "year"] as const, { description: "Only results from this period" }),
      ),
    }),
    async execute(_id, params, signal) {
      const n = Math.min(Math.max(Math.floor(params.count ?? 6), 1), 10);
      const args = ["-n", String(n)];
      if (params.freshness) args.push("-t", params.freshness);
      args.push(params.query);
      const { out, err, code } = await run(WEBSEARCH, args, signal);
      if (code !== 0) {
        return { content: [{ type: "text", text: `web_search failed: ${clip(err.trim() || "unknown error", 500)}` }], details: {} };
      }
      let results: SearchResult[];
      try {
        results = JSON.parse(out) as SearchResult[];
      } catch {
        return { content: [{ type: "text", text: "web_search failed: unparseable output" }], details: {} };
      }
      const text = results
        .map((r, i) => `${i + 1}. ${r.title ?? "(no title)"}\n   ${r.url ?? ""}\n   ${clip((r.snippet ?? "").replace(/\s+/g, " "), SNIPPET_CAP)}`)
        .join("\n\n");
      return { content: [{ type: "text", text: clip(text || "No results.", MAX_OUTPUT) }], details: {} };
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch a web page (JS-rendered, boilerplate stripped) as markdown. " +
      "Pass `filter` to keep only content relevant to a query on long pages.",
    parameters: Type.Object({
      url: Type.String({ description: "http(s) URL to fetch" }),
      filter: Type.Optional(Type.String({ description: "Keep only content blocks relevant to this query" })),
    }),
    async execute(_id, params, signal) {
      let parsed: URL;
      try {
        parsed = new URL(params.url);
      } catch {
        return { content: [{ type: "text", text: "web_fetch failed: invalid URL" }], details: {} };
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { content: [{ type: "text", text: "web_fetch failed: only http(s) URLs are allowed" }], details: {} };
      }
      const args: string[] = [];
      if (params.filter) args.push("--filter", params.filter);
      args.push(parsed.href);
      const { out, err, code } = await run(WEBCRAWL, args, signal);
      if (code !== 0 || !out.trim()) {
        return { content: [{ type: "text", text: `web_fetch failed: ${clip(err.trim() || "empty page", 500)}` }], details: {} };
      }
      return { content: [{ type: "text", text: clip(out, MAX_OUTPUT) }], details: {} };
    },
  });
}
