/**
 * scout — fan out read-only research to isolated pi children.
 *
 * One call takes a list of independent briefs. Each runs in its own `pi`
 * process (own context window, cheap model) and returns a short report, so
 * raw file reads and page dumps never enter the parent's context.
 *
 * Two profiles, both read-only by tool allowlist (not by prompt):
 *   - codebase: read, grep, find, ls — no bash, no write/edit
 *   - web:      web_search, web_fetch (lib/scout-web-tools.ts) — no shell, no files
 *
 * Children are not given this extension, so they cannot spawn scouts.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import { type ExtensionAPI, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const MAX_BRIEFS = 8;
const MAX_CONCURRENCY = 4;
const REPORT_CAP = 3_000;
const SCOUT_MODEL = "deepseek/deepseek-v4-flash";
const SCOUT_PROVIDER = "openrouter";
const WEB_TOOLS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "lib", "scout-web-tools.ts");

type Kind = "codebase" | "web";

const REPORT_RULES = [
  "Return a compressed report of at most ~400 words. Be terse and information-dense.",
  "Lead with the answer. Then list the evidence. Finish with a short 'Not verified' line for anything you could not confirm.",
  "Your reader cannot see anything you read, so include every fact they will need. Do not paste large bodies of text.",
].join("\n");

const PROFILES: Record<Kind, { tools: string[]; extensions: string[]; prompt: string }> = {
  codebase: {
    tools: ["read", "grep", "find", "ls"],
    extensions: [],
    prompt: [
      "You are a codebase scout. You can only read: grep, find, ls and read. You cannot run commands or change files.",
      "Locate code with grep/find first; read only the sections you need.",
      "Cite every claim as `path:line` (or `path:start-end`).",
      REPORT_RULES,
    ].join("\n\n"),
  },
  web: {
    tools: ["web_search", "web_fetch"],
    extensions: [WEB_TOOLS_PATH],
    prompt: [
      "You are a web research scout. You have web_search and web_fetch only.",
      "Search, then read the 1-3 most authoritative sources in full with web_fetch (use `filter` on long pages). Prefer primary sources: official docs, original posts, issue trackers. Search snippets are leads, not evidence.",
      "Cite every claim with its URL, and note publication dates where they matter. Separate sources you read in full from ones you only saw as snippets.",
      REPORT_RULES,
    ].join("\n\n"),
  },
};

interface ScoutState {
  kind: Kind;
  brief: string;
  status: "running" | "done" | "failed";
  toolCalls: number;
  lastTool?: string;
  report: string;
  error?: string;
  cost: number;
  turns: number;
}

interface ScoutDetails {
  scouts: ScoutState[];
}

interface PiJsonEvent {
  type?: string;
  message?: Message;
}

function preview(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

function finalText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    const text = msg.content
      .filter((p) => p.type === "text")
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

function piInvocation(args: string[]): { command: string; args: string[] } {
  const script = process.argv[1];
  if (script && !script.startsWith("/$bunfs/root/") && fs.existsSync(script)) {
    return { command: process.execPath, args: [script, ...args] };
  }
  const exec = path.basename(process.execPath).toLowerCase();
  if (/^(node|bun)(\.exe)?$/.test(exec)) return { command: "pi", args };
  return { command: process.execPath, args };
}

async function runScout(
  state: ScoutState,
  cwd: string,
  signal: AbortSignal | undefined,
  onChange: () => void,
): Promise<void> {
  const profile = PROFILES[state.kind];
  const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-scout-"));
  const promptPath = path.join(promptDir, "prompt.md");
  fs.writeFileSync(promptPath, profile.prompt, { encoding: "utf-8", mode: 0o600 });

  const args = [
    "--mode", "json", "-p", "--no-session",
    "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files",
    "--provider", SCOUT_PROVIDER, "--model", SCOUT_MODEL,
    "--tools", profile.tools.join(","),
    "--append-system-prompt", promptPath,
  ];
  for (const ext of profile.extensions) args.push("-e", ext);
  args.push(`Brief: ${state.brief}`);

  const messages: Message[] = [];
  let stderr = "";
  try {
    const code = await new Promise<number>((resolve) => {
      const inv = piInvocation(args);
      const proc = spawn(inv.command, inv.args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
      let buffer = "";

      const onLine = (line: string) => {
        if (!line.trim()) return;
        let event: PiJsonEvent;
        try {
          event = JSON.parse(line) as PiJsonEvent;
        } catch {
          return;
        }
        if (event.type !== "message_end" || !event.message) return;
        const msg = event.message;
        messages.push(msg);
        if (msg.role === "assistant") {
          state.turns++;
          state.cost += msg.usage?.cost?.total || 0;
          for (const part of msg.content) {
            if (part.type === "toolCall") {
              state.toolCalls++;
              state.lastTool = part.name;
            }
          }
          if (msg.errorMessage) state.error = msg.errorMessage;
        }
        onChange();
      };

      proc.stdout.on("data", (d) => {
        buffer += d.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const l of lines) onLine(l);
      });
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("close", (c) => {
        if (buffer.trim()) onLine(buffer);
        resolve(c ?? 0);
      });
      proc.on("error", () => resolve(1));

      if (signal) {
        const kill = () => {
          proc.kill("SIGTERM");
          setTimeout(() => {
            if (!proc.killed) proc.kill("SIGKILL");
          }, 5000);
        };
        if (signal.aborted) kill();
        else signal.addEventListener("abort", kill, { once: true });
      }
    });

    const text = finalText(messages);
    if (code !== 0 || !text) {
      state.status = "failed";
      state.error = state.error || preview(stderr, 300) || `exit code ${code}, no report`;
    } else {
      state.status = "done";
      state.report =
        text.length > REPORT_CAP ? `${text.slice(0, REPORT_CAP)}\n[report truncated at ${REPORT_CAP} chars]` : text;
    }
  } finally {
    fs.rmSync(promptDir, { recursive: true, force: true });
  }
  onChange();
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

const Brief = Type.Object({
  kind: StringEnum(["codebase", "web"] as const, {
    description: "codebase: read-only repo exploration. web: search and read web pages.",
  }),
  brief: Type.String({
    description:
      "Self-contained question or task. The scout sees nothing of this conversation: include paths, URLs, " +
      "names and what shape of answer you need.",
  }),
  cwd: Type.Optional(Type.String({ description: "Directory to scout (codebase kind). Defaults to the session cwd." })),
});

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "scout",
    label: "Scout",
    description: [
      "Fan out read-only research to isolated scouts that each return a short report.",
      "Pass several independent briefs in ONE call to run them in parallel (max 8, 4 at a time).",
      "kind=codebase scouts read files (read/grep/find/ls) to map code; kind=web scouts search and read web pages.",
      "Scouts cannot edit files or run commands, and they do not see this conversation, so each brief must be self-contained.",
      "Reports are compressed; verify anything load-bearing yourself before acting on it.",
    ].join(" "),
    promptSnippet: "Fan out read-only codebase/web research to parallel scouts that return short reports",
    promptGuidelines: [
      "Use scout to explore unfamiliar code or read several web sources without filling your own context. Split the work into independent briefs and send them in one call.",
      "Do not use scout for edits, debugging, or small lookups you can do with one grep or read.",
      "A scout's report is a lead, not proof: read the cited file:line or URL yourself before relying on it for a change or a recommendation.",
    ],
    parameters: Type.Object({
      briefs: Type.Array(Brief, { minItems: 1, maxItems: MAX_BRIEFS, description: "Independent scouting briefs" }),
    }),

    async execute(_id, params, signal, onUpdate, ctx) {
      if (params.briefs.length > MAX_BRIEFS) {
        return {
          content: [{ type: "text", text: `Too many briefs (${params.briefs.length}). Max is ${MAX_BRIEFS}.` }],
          details: { scouts: [] } satisfies ScoutDetails,
        };
      }

      const scouts: ScoutState[] = params.briefs.map((b) => ({
        kind: b.kind,
        brief: b.brief,
        status: "running",
        toolCalls: 0,
        report: "",
        cost: 0,
        turns: 0,
      }));

      const push = () => {
        const done = scouts.filter((s) => s.status !== "running").length;
        onUpdate?.({
          content: [{ type: "text", text: `Scouting: ${done}/${scouts.length} finished` }],
          details: { scouts: scouts.map((s) => ({ ...s })) } satisfies ScoutDetails,
        });
      };
      push();

      await mapLimit(params.briefs.map((b, i) => ({ b, i })), MAX_CONCURRENCY, async ({ b, i }) => {
        await runScout(scouts[i], b.cwd ?? ctx.cwd, signal, push);
      });

      const text = scouts
        .map((s, i) => {
          const head = `## Scout ${i + 1} (${s.kind}): ${preview(s.brief, 100)}`;
          return s.status === "done" ? `${head}\n\n${s.report}` : `${head}\n\nFAILED: ${s.error ?? "unknown error"}`;
        })
        .join("\n\n");

      return {
        content: [{ type: "text", text }],
        details: { scouts } satisfies ScoutDetails,
        isError: scouts.every((s) => s.status === "failed"),
      };
    },

    renderCall(args, theme) {
      const briefs = args.briefs ?? [];
      let text =
        theme.fg("toolTitle", theme.bold("scout ")) + theme.fg("accent", `${briefs.length} brief${briefs.length === 1 ? "" : "s"}`);
      for (const b of briefs.slice(0, 4)) {
        text += `\n  ${theme.fg("accent", b.kind ?? "?")} ${theme.fg("dim", preview(b.brief ?? "", 70))}`;
      }
      if (briefs.length > 4) text += `\n  ${theme.fg("muted", `... +${briefs.length - 4} more`)}`;
      return new Text(text, 0, 0);
    },

    renderResult(result, { expanded }, theme) {
      const details = result.details as ScoutDetails | undefined;
      if (!details || details.scouts.length === 0) {
        const first = result.content[0];
        return new Text(first?.type === "text" ? first.text : "(no output)", 0, 0);
      }
      const container = new Container();
      const total = details.scouts.reduce((n, s) => n + s.cost, 0);
      for (const s of details.scouts) {
        const icon =
          s.status === "running" ? theme.fg("warning", "⏳") : s.status === "done" ? theme.fg("success", "✓") : theme.fg("error", "✗");
        const activity =
          s.status === "running"
            ? theme.fg("muted", ` ${s.toolCalls} tool calls${s.lastTool ? ` · ${s.lastTool}` : ""}`)
            : theme.fg("muted", ` ${s.toolCalls} tool calls · $${s.cost.toFixed(4)}`);
        container.addChild(
          new Text(`${icon} ${theme.fg("accent", s.kind)} ${theme.fg("dim", preview(s.brief, 60))}${activity}`, 0, 0),
        );
        if (s.status === "failed") container.addChild(new Text(theme.fg("error", `  ${s.error ?? "failed"}`), 0, 0));
        if (expanded && s.status === "done") {
          container.addChild(new Spacer(1));
          container.addChild(new Markdown(s.report, 2, 0, getMarkdownTheme()));
          container.addChild(new Spacer(1));
        }
      }
      if (!expanded && details.scouts.some((s) => s.status === "done")) {
        container.addChild(new Text(theme.fg("muted", "(Ctrl+O to expand reports)"), 0, 0));
      }
      if (total > 0) container.addChild(new Text(theme.fg("dim", `total $${total.toFixed(4)}`), 0, 0));
      return container;
    },
  });
}
