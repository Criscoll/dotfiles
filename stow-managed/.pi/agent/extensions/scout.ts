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
 *
 * Fire-and-forget: `scout` returns immediately and scouts run as background
 * jobs. Each finished report is delivered as a follow-up message (arrives when
 * the agent would otherwise stop, and wakes an idle agent). `scout_wait` blocks
 * on outstanding scouts when the agent needs findings before continuing.
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

let activeScouts = 0;
const slotWaiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeScouts < MAX_CONCURRENCY) {
    activeScouts++;
    return;
  }
  await new Promise<void>((resolve) => slotWaiters.push(resolve));
}

function releaseSlot(): void {
  const next = slotWaiters.shift();
  if (next) next();
  else activeScouts--;
}

interface Job {
  id: string;
  state: ScoutState;
  abort: AbortController;
  promise: Promise<void>;
  /** Report already delivered as a follow-up, or claimed by scout_wait. */
  handled: boolean;
}

function reportText(job: Job): string {
  const head = `## Scout ${job.id} (${job.state.kind}): ${preview(job.state.brief, 100)}`;
  return job.state.status === "done"
    ? `${head}\n\n${job.state.report}`
    : `${head}\n\nFAILED: ${job.state.error ?? "unknown error"}`;
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
  const jobs = new Map<string, Job>();
  let nextId = 1;
  let ui: { setStatus(key: string, text: string | undefined): void } | undefined;

  const updateStatus = () => {
    const running = [...jobs.values()].filter((j) => j.state.status === "running").length;
    ui?.setStatus("scout", running > 0 ? `scouts: ${running} running` : undefined);
  };

  pi.on("session_start", async (_event, ctx) => {
    ui = ctx.hasUI ? ctx.ui : undefined;
  });

  pi.on("session_shutdown", async () => {
    for (const job of jobs.values()) job.abort.abort();
    jobs.clear();
    ui?.setStatus("scout", undefined);
    ui = undefined;
  });

  pi.registerMessageRenderer("scout-report", (message, options, theme) => {
    const d = message.details as { scout?: ScoutState; id?: string } | undefined;
    const s = d?.scout;
    const container = new Container();
    if (!s) {
      container.addChild(new Text(String(message.content), options.outputPad, 0));
      return container;
    }
    const icon = s.status === "done" ? theme.fg("success", "✓") : theme.fg("error", "✗");
    container.addChild(
      new Text(
        `${icon} ${theme.bold("scout " + (d?.id ?? ""))} ${theme.fg("accent", s.kind)} ${theme.fg("dim", preview(s.brief, 60))}` +
          theme.fg("muted", ` ${s.toolCalls} tool calls · $${s.cost.toFixed(4)}`),
        options.outputPad,
        0,
      ),
    );
    if (s.status === "failed") container.addChild(new Text(theme.fg("error", `  ${s.error ?? "failed"}`), options.outputPad, 0));
    else if (options.expanded) container.addChild(new Markdown(s.report, options.outputPad + 2, 0, getMarkdownTheme()));
    else container.addChild(new Text(theme.fg("muted", "  (Ctrl+O to expand report)"), options.outputPad, 0));
    return container;
  });

  pi.registerTool({
    name: "scout",
    label: "Scout",
    description: [
      "Launch read-only research scouts in the BACKGROUND and return immediately; you keep working.",
      "Each scout's compressed report arrives automatically as a follow-up message once it finishes (when you would otherwise stop).",
      "Call scout_wait to block on them if you need the findings before you can continue.",
      "Pass several independent briefs in ONE call (max 8, 4 run at a time).",
      "kind=codebase scouts read files (read/grep/find/ls) to map code; kind=web scouts search and read web pages.",
      "Scouts cannot edit files or run commands, and they do not see this conversation, so each brief must be self-contained.",
      "Reports are compressed; verify anything load-bearing yourself before acting on it.",
    ].join(" "),
    promptSnippet: "Launch background read-only codebase/web scouts; reports arrive later as follow-up messages",
    promptGuidelines: [
      "Use scout to explore unfamiliar code or read several web sources without filling your own context. Split the work into independent briefs and send them in one call.",
      "scout returns immediately. Do other useful work that does not depend on the findings while scouts run; their reports arrive as follow-up messages.",
      "Before any step that depends on a scout's findings, call scout_wait rather than guessing or ending your turn. Never claim scouting is complete until the reports have arrived.",
      "Do not use scout for edits, debugging, or small lookups you can do with one grep or read.",
      "A scout's report is a lead, not proof: read the cited file:line or URL yourself before relying on it for a change or a recommendation.",
    ],
    parameters: Type.Object({
      briefs: Type.Array(Brief, { minItems: 1, maxItems: MAX_BRIEFS, description: "Independent scouting briefs" }),
    }),

    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (params.briefs.length > MAX_BRIEFS) {
        return {
          content: [{ type: "text", text: `Too many briefs (${params.briefs.length}). Max is ${MAX_BRIEFS}.` }],
          details: { scouts: [] } satisfies ScoutDetails,
        };
      }
      if (ctx.hasUI) ui = ctx.ui;

      const launched: Job[] = params.briefs.map((b) => {
        const state: ScoutState = {
          kind: b.kind,
          brief: b.brief,
          status: "running",
          toolCalls: 0,
          report: "",
          cost: 0,
          turns: 0,
        };
        const job: Job = {
          id: `s${nextId++}`,
          state,
          abort: new AbortController(),
          handled: false,
          promise: Promise.resolve(),
        };
        const cwd = b.cwd ?? ctx.cwd;
        job.promise = (async () => {
          await acquireSlot();
          try {
            if (job.abort.signal.aborted) {
              state.status = "failed";
              state.error = "cancelled";
            } else {
              await runScout(state, cwd, job.abort.signal, updateStatus);
            }
          } catch (err) {
            state.status = "failed";
            state.error = err instanceof Error ? err.message : String(err);
          } finally {
            releaseSlot();
          }
          updateStatus();
          if (!job.handled && !job.abort.signal.aborted) {
            job.handled = true;
            pi.sendMessage(
              { customType: "scout-report", content: reportText(job), display: true, details: { id: job.id, scout: { ...state } } },
              { deliverAs: "followUp", triggerTurn: true },
            );
          }
        })();
        jobs.set(job.id, job);
        return job;
      });
      updateStatus();

      const list = launched.map((j) => `- ${j.id} (${j.state.kind}): ${preview(j.state.brief, 100)}`).join("\n");
      return {
        content: [
          {
            type: "text",
            text:
              `Launched ${launched.length} scout${launched.length === 1 ? "" : "s"} in the background:\n${list}\n\n` +
              "Reports arrive as follow-up messages when they finish. Continue with work that does not depend on them; " +
              "call scout_wait if you need the findings first.",
          },
        ],
        details: { scouts: launched.map((j) => ({ ...j.state })) } satisfies ScoutDetails,
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

  pi.registerTool({
    name: "scout_wait",
    label: "Scout wait",
    description:
      "Block until background scouts finish and return their reports. With no ids, waits for every scout whose report has not yet been delivered. " +
      "Use it before any step that depends on scout findings. Does nothing if no scouts are outstanding.",
    promptSnippet: "Wait for outstanding background scouts and return their reports",
    parameters: Type.Object({
      ids: Type.Optional(Type.Array(Type.String(), { description: "Scout ids (e.g. s1) to wait for. Default: all outstanding." })),
    }),

    async execute(_id, params, signal) {
      const known = params.ids?.length
        ? params.ids.map((id) => jobs.get(id)).filter((j): j is Job => !!j)
        : [...jobs.values()].filter((j) => !j.handled);
      const unknown = (params.ids ?? []).filter((id) => !jobs.has(id));
      if (known.length === 0) {
        const note = unknown.length ? ` Unknown ids: ${unknown.join(", ")}.` : "";
        return { content: [{ type: "text", text: `No outstanding scouts.${note}` }], details: {} };
      }
      if (signal?.aborted) return { content: [{ type: "text", text: "Wait cancelled; scouts keep running." }], details: {} };

      const claimed = known.filter((j) => !j.handled);
      for (const j of claimed) j.handled = true;

      const interrupted = new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve(), { once: true }));
      await Promise.race([Promise.all(known.map((j) => j.promise)), interrupted]);

      if (signal?.aborted) {
        for (const j of claimed) if (j.state.status === "running") j.handled = false;
        return { content: [{ type: "text", text: "Wait cancelled; scouts keep running and will report as follow-ups." }], details: {} };
      }

      const text = known.map(reportText).join("\n\n") + (unknown.length ? `\n\nUnknown ids: ${unknown.join(", ")}` : "");
      return { content: [{ type: "text", text }], details: { scouts: known.map((j) => ({ ...j.state })) } satisfies ScoutDetails };
    },
  });
}
