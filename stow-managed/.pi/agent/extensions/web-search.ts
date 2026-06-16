/**
 * web_search — On-demand web search via local SearXNG (Docker-backed).
 *
 * Calls ~/bin/agent_scripts/websearch, which manages the SearXNG Docker
 * container lifecycle automatically (start → query → stop).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { homedir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(homedir(), "bin", "agent_scripts", "websearch");

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web on-demand using a local SearXNG instance (Docker-backed). " +
      "Returns titles, URLs, and snippets from live search results. " +
      "Use for current events, recent documentation, news, or any query needing real-time information.",
    promptSnippet: "Search the web for real-time information via local SearXNG",
    promptGuidelines: [
      "Use web_search when the user asks for current information, recent news, or anything that may have changed since your training cutoff.",
      "After web_search returns URLs, use the bash tool to run webcrawl on the most relevant hits to fetch full page content.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "The search query",
      }),
      max_results: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return (default: 10)",
          minimum: 1,
          maximum: 50,
        }),
      ),
      engines: Type.Optional(
        Type.String({
          description:
            "Comma-separated list of search engines to use (e.g. 'google,duckduckgo'). Default: all available.",
        }),
      ),
      time_range: Type.Optional(
        Type.String({
          description: "Filter results by recency: 'day', 'month', or 'year'",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const args: string[] = [];

      if (params.max_results != null) {
        args.push("-n", String(params.max_results));
      }
      if (params.engines) {
        args.push("-e", params.engines);
      }
      if (params.time_range) {
        args.push("-t", params.time_range);
      }

      // Query is positional — must come after all flags.
      args.push(params.query);

      const flagParts: string[] = [`max: ${params.max_results ?? 10}`];
      if (params.engines) flagParts.push(`engines: ${params.engines}`);
      if (params.time_range) flagParts.push(`time_range: ${params.time_range}`);
      onUpdate?.({
        content: [{ type: "text" as const, text: `Searching: "${params.query}"  (${flagParts.join("  ")})` }],
        details: {},
      });

      const result = await pi.exec(SCRIPT, args, { signal });

      if (result.code !== 0) {
        throw new Error(
          `websearch failed (exit ${result.code}): ${result.stderr || "(no output)"}`,
        );
      }

      let results: Array<{
        title: string;
        url: string;
        snippet: string;
        engine: string;
      }>;

      try {
        results = JSON.parse(result.stdout);
      } catch {
        throw new Error(
          `websearch returned invalid JSON: ${result.stdout.slice(0, 200)}`,
        );
      }

      if (results.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No results found for: ${params.query}` }],
          details: { query: params.query, results: [] },
        };
      }

      const engineCounts: Record<string, number> = {};
      for (const r of results) {
        if (r.engine) engineCounts[r.engine] = (engineCounts[r.engine] ?? 0) + 1;
      }
      const engineSummary = Object.entries(engineCounts)
        .map(([e, n]) => `${e} ×${n}`)
        .join(", ");

      const preview: string[] = [`Results (${results.length}):`, ""];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const tag = r.engine ? `[${r.engine}]` : "";
        preview.push(`  ${i + 1}. ${tag} ${r.title}`);
        preview.push(`     ${r.url}`);
        if (r.snippet) preview.push(`     ${r.snippet.slice(0, 120)}`);
        preview.push("");
      }
      if (engineSummary) preview.push(`Engines: ${engineSummary}`);
      onUpdate?.({
        content: [{ type: "text" as const, text: preview.join("\n") }],
        details: {},
      });

      const lines: string[] = [`Search results for: ${params.query}`, ""];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(`${i + 1}. ${r.title}`);
        lines.push(`   URL: ${r.url}`);
        if (r.snippet) lines.push(`   ${r.snippet}`);
        if (r.engine) lines.push(`   [via ${r.engine}]`);
        lines.push("");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
        details: { query: params.query, results },
      };
    },
  });
}
