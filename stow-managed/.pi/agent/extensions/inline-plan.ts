/**
 * Inline Plan Extension
 *
 * A plan-mode workflow driven by the MAIN agent — so you watch its reasoning and
 * tool calls stream live in the chat — with a toggleable near-full-screen overlay
 * for reviewing the plan and attaching line-anchored comments, and a fresh-session
 * handoff to a chosen executor model.
 *
 * Flow:
 *   /plan <goal>     Enable plan mode (read-only tools) and kick off the agent. The
 *                    agent explores and emits a markdown plan wrapped in
 *                    <!--PLAN--> ... <!--/PLAN--> markers, re-emitting the full plan
 *                    on every refinement.
 *   (watch in chat)  The agent's thinking + tool calls stream normally.
 *   Alt+P            Toggle the plan overlay: read the rendered plan, visually select
 *                    lines, leave comments, then:
 *                      v  visual select lines
 *                      c  comment on cursor/selection
 *                      s  submit comments  -> modal to review then send; agent revises
 *                      a  accept           -> model select + fresh-session handoff
 *                      /  section search + jump
 *                      y  copy plan path to editor
 *                      esc close           -> back to chat to watch the agent work
 *   Freeform refine  Anything typed in the normal chat input while in plan mode is
 *                    treated as a refinement request by the agent.
 *   /plan            (no args, while enabled) disable plan mode, restore full tools.
 *
 * Modeled on pi's official plan-mode example pattern. Single file, zero npm deps.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Type } from "typebox";

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { BorderedLoader, DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import {
	Container,
	Editor,
	type EditorTheme,
	Key,
	Markdown,
	matchesKey,
	type SelectItem,
	SelectList,
	Text,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAN_START = "<!--PLAN-->";
const PLAN_END = "<!--/PLAN-->";

/** Read-only tool allowlist while drafting a plan (matches the official example). */
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire", "write_plan"];

const TOGGLE_SHORTCUT = "alt+p";

// ─── Planning Directive ───────────────────────────────────────────────────────

function planDirective(goal: string): string {
	const goalSection = goal
		? `Goal:\n${goal}`
		: `Goal:\n(Not yet specified — learn it from the conversation)`;
	return `[PLAN MODE ACTIVE]
You are in plan mode: a read-only planning phase. Do NOT modify files or run mutating commands.

${goalSection}

Your job:
1. If the goal or scope is unclear, use the questionnaire tool to ask the user clarifying questions BEFORE exploring or drafting.
2. Explore the codebase as needed (read-only tools only) to build enough context.
3. Draft a plan only once you have enough information — do NOT emit a plan immediately if you still need clarification or exploration.
4. Produce ONE comprehensive, self-contained implementation plan. It will be handed to a
   FRESH agent with no prior context, so it must be executable from the plan + codebase alone.
   The fresh agent has NO access to this chat, earlier messages, or any external document — so
   never reference "the ideas file", "as discussed above", or anything not contained in the plan.
   Carry your exploration forward: when a step depends on a non-obvious API, event name, function
   signature, or config shape you had to discover, inline the exact signature plus a file:line
   reference in that step so the executor does not re-explore what you already found.
5. Treat every subsequent user message as additional context or a refinement request and revise the plan accordingly.

Output rules (critical — only once you are ready to emit a plan):
- Call the write_plan tool with the COMPLETE plan as the \`plan\` argument.
- Do NOT print the plan text inline in chat — submit it via the tool only.
- Write ## Approach before ## Constraints: explain the solution strategy and key
  trade-offs in 3–5 sentences, not a step list. For ## Constraints, include only
  facts that constrain or explain a decision — each bullet must state why it is listed.
- Use this markdown structure for the plan argument:
  # Plan: <short title>
  ## Goal
  <the problem being solved and what success looks like — one short paragraph>
  ## Approach
  <how we're solving it — key design decisions and why, in 3–5 sentences. Not a
   step list. State the shape of the solution and why this way over alternatives.>
  ## Constraints
  <only facts that constrain or explain a decision — each bullet states why it is
   listed. Omit background noise.>
  ## Steps
  1. **<step title>** — what to do, why it serves the goal, and any non-obvious
     risk. Files: path/a.ts, path/b.ts
  2. **<step title>** — ...
  ## Verification
  - how to test / verify the change end to end. Every bullet MUST be runnable by a
    non-interactive agent: a concrete command paired with its expected output. Do NOT write
    steps that require driving an interactive session (e.g. "ask Claude to edit a file and watch
    the hook fire", "ask pi to …") — the executor cannot do that. For harness or integration
    wiring, prescribe a synthetic check instead: invoke the hook command directly with the same
    env vars the harness would set, or fire a synthetic event at the handler. Do NOT propose a
    syntax-only check (e.g. node -c on a .ts file) as proof of correctness — it proves nothing
    about behaviour.
- You may write a short explanation in chat, but the authoritative plan must be
  submitted via write_plan.`;
}

// ─── Plan Extraction ──────────────────────────────────────────────────────────

function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

function getText(m: AssistantMessage): string {
	return m.content
		.filter((b): b is TextContent => b.type === "text")
		.map((b) => b.text)
		.join("\n");
}

/** Find the most recent assistant message carrying a marked plan block; return its inner markdown. */
function extractPlanFromMessages(messages: AgentMessage[]): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (!isAssistantMessage(m)) continue;
		const text = getText(m);
		const start = text.lastIndexOf(PLAN_START);
		const end = text.lastIndexOf(PLAN_END);
		if (start >= 0 && end > start) {
			return text.slice(start + PLAN_START.length, end).trim();
		}
	}
	return null;
}

// ─── Comment Anchors ──────────────────────────────────────────────────────────

interface Comment {
	/** Line range + first-line text (display label). */
	anchor: string;
	/** Index into mdLines[] where the comment starts. */
	lineStart: number;
	/** Index into mdLines[] where the comment ends. */
	lineEnd: number;
	text: string;
}

function stripInline(s: string): string {
	return s
		.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.trim();
}

function composeRefine(comments: Comment[]): string {
	const body = comments.map((c) => `- [${c.anchor}] ${c.text}`).join("\n");
	return (
		`Review comments on the plan:\n\n${body}\n\n` +
		`Instructions:\n` +
		`1. For each comment, decide independently: does it require a plan change, or is it a question, clarification request, or observation that can be answered in prose?\n` +
		`2. You are NOT required to edit the plan for every comment. Push back, answer, or discuss freely when that is the right response.\n` +
		`3. Only if one or more comments warrant an actual plan change: call write_plan with the COMPLETE updated plan — do NOT print it inline.\n` +
		`4. After addressing all comments, write a brief reply (one line per comment) describing what you did — e.g. "- [anchor]: Answered inline / Updated Step 2 / No change needed because…".`
	);
}

// ─── Plan File Persistence ────────────────────────────────────────────────────

function savePlanFile(plan: string, goal: string): string {
	const dir = join(homedir(), ".pi", "plans");
	mkdirSync(dir, { recursive: true });
	const slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const file = join(dir, `${ts}-${slug}.md`);
	writeFileSync(file, plan, "utf8");
	return file;
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

type OverlayResult =
	| { action: "submit"; comments: Comment[] }
	| { action: "accept"; model: string | null; newSession: boolean }
	| { action: "close" };

function viewportRows(tui: { rows?: number; height?: number }): number {
	const h =
		typeof tui?.rows === "number" ? tui.rows :
		typeof tui?.height === "number" ? tui.height :
		(typeof process !== "undefined" && process.stdout?.rows) || 40;
	// 7 = top-border + title + rule + rule + summary + hint + bottom-border
	return Math.max(12, Math.floor(h * 0.92) - 7);
}

// ─── Sidebar Helpers ──────────────────────────────────────────────────────────

interface HeadingEntry { level: number; text: string; approxLine: number; }

function buildHeadingMap(plan: string, totalRenderedLines: number): HeadingEntry[] {
	const rawLines = plan.split("\n");
	const entries: HeadingEntry[] = [];
	let inCodeBlock = false;
	for (let i = 0; i < rawLines.length; i++) {
		const trimmed = rawLines[i].trim();
		if (trimmed.startsWith("```")) { inCodeBlock = !inCodeBlock; continue; }
		if (inCodeBlock) continue;
		const m = rawLines[i].match(/^(#{1,6})\s+(.*)$/);
		if (m) entries.push({
			level: m[1].length,
			text: stripInline(m[2]),
			approxLine: Math.round((i / rawLines.length) * totalRenderedLines),
		});
	}
	return entries;
}

function activeSectionIdx(headings: HeadingEntry[], scrollOffset: number): number {
	let idx = 0;
	for (let i = 0; i < headings.length; i++) {
		if (headings[i].approxLine <= scrollOffset + 1) idx = i;
	}
	return idx;
}

function renderSidebar(
	headings: HeadingEntry[], activeIdx: number,
	maxRows: number, width: number, theme: any,
): string[] {
	const lines: string[] = [];
	for (let i = 0; i < headings.length && lines.length < maxRows; i++) {
		const h = headings[i];
		const indent = "  ".repeat(Math.max(0, h.level - 1));
		const isActive = i === activeIdx;
		const prefix = isActive ? "▸ " : "  ";
		const raw = truncateToWidth(indent + prefix + h.text, width);
		const pad = " ".repeat(Math.max(0, width - visibleWidth(raw)));
		lines.push(isActive
			? theme.fg("accent", raw + pad)
			: theme.fg("muted", raw) + pad);
	}
	while (lines.length < maxRows) lines.push(" ".repeat(width));
	return lines;
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function openSubmitModal(ctx: any, comments: Comment[]): Promise<"submit" | null> {
	return ctx.ui.custom<"submit" | null>(
		(tui: any, theme: any, _kb: any, done: (r: "submit" | null) => void) => {
			let selectedIdx = 0;
			let editingIdx: number | null = null;

			const editorTheme: EditorTheme = {
				borderColor: (s: string) => theme.fg("accent", s),
				selectList: {
					selectedPrefix: (t: string) => theme.fg("accent", t),
					selectedText: (t: string) => theme.fg("accent", t),
					description: (t: string) => theme.fg("muted", t),
					scrollInfo: (t: string) => theme.fg("dim", t),
					noMatch: (t: string) => theme.fg("warning", t),
				},
			};
			const editor = new Editor(tui, editorTheme);

			editor.onSubmit = (value: string) => {
				if (editingIdx !== null) {
					const t = value.trim();
					if (t) comments[editingIdx].text = t;
					else { comments.splice(editingIdx, 1); selectedIdx = Math.min(selectedIdx, Math.max(0, comments.length - 1)); }
					editingIdx = null;
					editor.setText("");
				}
				tui.requestRender();
			};

			return {
				render(w: number): string[] {
					const border = (s: string) => theme.fg("border", s);
					const inner = w - 4;
					const out: string[] = [];
					const row = (content: string) => {
						const clipped = truncateToWidth(content, inner);
						const pad = Math.max(0, inner - visibleWidth(clipped));
						return border("│ ") + clipped + " ".repeat(pad) + border(" │");
					};

					out.push(border(`┌${"─".repeat(w - 2)}┐`));
					out.push(row(theme.fg("accent", theme.bold(`Submit comments (${comments.length})`))));
					out.push(border(`├${"─".repeat(w - 2)}┤`));

					if (editingIdx !== null && editingIdx < comments.length) {
						out.push(row(theme.fg("accent", "Edit: ") + theme.fg("muted", comments[editingIdx].anchor)));
						for (const l of editor.render(inner)) out.push(row(l));
						out.push(border(`├${"─".repeat(w - 2)}┤`));
						out.push(row(theme.fg("dim", "enter save · empty → delete · esc cancel edit")));
					} else {
						if (comments.length === 0) {
							out.push(row(theme.fg("dim", "No comments.")));
						} else {
							for (let i = 0; i < comments.length; i++) {
								const c = comments[i];
								const prefix = i === selectedIdx ? theme.fg("accent", "▶ ") : "  ";
								const anchor = theme.fg("accent", `[${c.anchor}]`);
								const text = " " + (i === selectedIdx ? c.text : theme.fg("muted", c.text));
								out.push(row(prefix + anchor + text));
							}
						}
						out.push(border(`├${"─".repeat(w - 2)}┤`));
						out.push(row(theme.fg("dim", "j/k navigate · e edit · d delete · s/enter submit · esc cancel")));
					}

					out.push(border(`└${"─".repeat(w - 2)}┘`));
					return out;
				},

				invalidate() {},

				handleInput(data: string) {
					if (editingIdx !== null) {
						if (matchesKey(data, Key.escape)) {
							editor.setText("");
							editingIdx = null;
							tui.requestRender();
						} else {
							editor.handleInput(data);
							tui.requestRender();
						}
						return;
					}

					if (data === "j" || matchesKey(data, Key.down)) {
						selectedIdx = Math.min(selectedIdx + 1, Math.max(0, comments.length - 1));
					} else if (data === "k" || matchesKey(data, Key.up)) {
						selectedIdx = Math.max(selectedIdx - 1, 0);
					} else if (data === "e") {
						if (comments.length > 0) {
							editingIdx = selectedIdx;
							editor.setText(comments[selectedIdx].text);
						}
					} else if (data === "d" || data === "D") {
						if (comments.length > 0) {
							comments.splice(selectedIdx, 1);
							selectedIdx = Math.min(selectedIdx, Math.max(0, comments.length - 1));
						}
					} else if (data === "s" || data === "S" || data === "\r") {
						if (comments.length > 0) { done("submit"); return; }
					} else if (matchesKey(data, Key.escape)) {
						done(null);
						return;
					}
					tui.requestRender();
				},

				dispose() {
					editor.dispose();
				},
			};
		},
		{ overlay: true, overlayOptions: { width: "70%", maxHeight: "60%", anchor: "center", minWidth: 52 } },
	);
}

// ─── Plan Overlay ─────────────────────────────────────────────────────────────

function openPlanOverlay(ctx: any, plan: string, goal: string, planFile: string): Promise<OverlayResult | null> {
	return ctx.ui.custom<OverlayResult | null>(
		(tui: any, theme: any, _kb: any, done: (r: OverlayResult | null) => void) => {
			let mdTheme = getMarkdownTheme();
			let md = new Markdown(plan, 0, 0, mdTheme);
			const comments: Comment[] = [];

			let mode: "view" | "pick" | "edit" | "confirm" = "view";
			let scrollOffset = 0;
			let cursorLine = 0;
			let selectionStart: number | null = null;
			let mdLines: string[] = [];
			let headings: HeadingEntry[] = [];
			let pendingAnchor = "";
			let pendingLineStart = 0;
			let pendingLineEnd = 0;
			let countBuffer = "";
			let pendingG = false;
			let modelSelectorOpen = false;

			const editorTheme: EditorTheme = {
				borderColor: (s: string) => theme.fg("accent", s),
				selectList: {
					selectedPrefix: (t: string) => theme.fg("accent", t),
					selectedText: (t: string) => theme.fg("accent", t),
					description: (t: string) => theme.fg("muted", t),
					scrollInfo: (t: string) => theme.fg("dim", t),
					noMatch: (t: string) => theme.fg("warning", t),
				},
			};
			const editor = new Editor(tui, editorTheme);
			let selectList: SelectList | null = null;

			const requestRender = () => tui.requestRender();

			editor.onSubmit = (value: string) => {
				const t = value.trim();
				const idx = comments.findIndex(c => c.lineStart === pendingLineStart && c.lineEnd === pendingLineEnd);
				if (!t) { if (idx >= 0) comments.splice(idx, 1); }
				else if (idx >= 0) { comments[idx].text = t; comments[idx].anchor = pendingAnchor; }
				else comments.push({ anchor: pendingAnchor, lineStart: pendingLineStart, lineEnd: pendingLineEnd, text: t });
				editor.setText("");
				mode = "view";
				requestRender();
			};

			const openNavPicker = () => {
				const items: SelectItem[] = headings.map((h) => ({
					value: String(h.approxLine),
					label: h.text,
					description: "",
				}));
				if (!items.length) return;
				selectList = new SelectList(items, Math.min(items.length, viewportRows(tui)), {
					selectedPrefix: (t: string) => theme.fg("accent", t),
					selectedText: (t: string) => theme.fg("accent", t),
					description: (t: string) => theme.fg("success", t),
					scrollInfo: (t: string) => theme.fg("dim", t),
					noMatch: (t: string) => theme.fg("warning", t),
				});
				selectList.onSelect = (item: SelectItem) => {
					const line = parseInt(item.value, 10);
					cursorLine = line;
					const maxV = viewportRows(tui);
					scrollOffset = Math.min(line, Math.max(0, mdLines.length - maxV));
					mode = "view";
					requestRender();
				};
				selectList.onCancel = () => {
					mode = "view";
					requestRender();
				};
				mode = "pick";
				requestRender();
			};

			return {
				render(width: number): string[] {
					const inner = width - 4;
					const out: string[] = [];
					const border = (s: string) => theme.fg("border", s);
					const row = (content: string) => {
						const clipped = truncateToWidth(content, inner);
						const pad = Math.max(0, inner - visibleWidth(clipped));
						return border("│ ") + clipped + " ".repeat(pad) + border(" │");
					};
					const rule = () => border(`├${"─".repeat(width - 2)}┤`);

					out.push(border(`┌${"─".repeat(width - 2)}┐`));
					const pathHint = planFile
						? theme.fg("dim", `  ${planFile.replace(homedir(), "~")}`)
						: "";
					const title =
						theme.fg("accent", theme.bold("Plan Review")) +
						(goal ? theme.fg("muted", `  ${goal}`) : "") +
						pathHint;
					out.push(row(title));

					if (mode === "pick" && selectList) {
						out.push(rule());
						for (const l of selectList.render(inner)) out.push(row(l));
						out.push(rule());
						out.push(row(theme.fg("dim", "/ type to search · j/k navigate · l/enter jump · esc back")));
						out.push(border(`└${"─".repeat(width - 2)}┘`));
						return out;
					}

					if (mode === "confirm") {
						out.push(rule());
						out.push(
							row(
								theme.fg("warning", `Discard ${comments.length} unsent comment(s)? `) +
									theme.fg("dim", "y / n"),
							),
						);
						out.push(border(`└${"─".repeat(width - 2)}┘`));
						return out;
					}

					// view mode — two-column layout: sidebar | cursor | linenum | comment | │ | main
					const SB = 28;
					const numWidth = 4;
					const mainW = Math.max(20, inner - SB - 8); // SB + │(1) + cursor(1) + linenum(4) + comment(1) + │(1)
					mdLines = md.render(mainW);
					const maxVisible = viewportRows(tui);
					scrollOffset = Math.min(scrollOffset, Math.max(0, mdLines.length - maxVisible));
					cursorLine = Math.min(cursorLine, Math.max(0, mdLines.length - 1));
					const end = Math.min(scrollOffset + maxVisible, mdLines.length);

					headings = buildHeadingMap(plan, mdLines.length);
					const activeIdx = activeSectionIdx(headings, scrollOffset);
					const sidebarLines = renderSidebar(headings, activeIdx, maxVisible, SB, theme);

					const splitHeaderRule = border(`├${"─".repeat(SB + 1)}┬${"─".repeat(numWidth + mainW + 4)}┤`);
					const splitFooterRule = border(`├${"─".repeat(SB + 1)}┴${"─".repeat(numWidth + mainW + 4)}┤`);

					out.push(splitHeaderRule);

					const cursorMark = (lineIdx: number): string => {
						if (lineIdx === cursorLine) return "▶";
						if (selectionStart !== null &&
							lineIdx >= Math.min(selectionStart, cursorLine) &&
							lineIdx <= Math.max(selectionStart, cursorLine)) return "│";
						return " ";
					};

					const commentMark = (lineIdx: number): string =>
						comments.some(c => lineIdx >= c.lineStart && lineIdx <= c.lineEnd)
							? theme.fg("muted", "●") : " ";

					const twoColRow = (sbLine: string, cursor: string, lnStr: string, cmt: string, mainContent: string) => {
						const clipped = truncateToWidth(mainContent, mainW);
						const pad = Math.max(0, mainW - visibleWidth(clipped));
						return border("│ ") + sbLine + border("│") + cursor + lnStr + cmt + border("│") + clipped + " ".repeat(pad) + border(" │");
					};

					for (let i = 0; i < maxVisible; i++) {
						const lineIdx = scrollOffset + i;
						const inSel = selectionStart !== null &&
							lineIdx >= Math.min(selectionStart, cursorLine) &&
							lineIdx <= Math.max(selectionStart, cursorLine);
						const rawLine = mdLines[lineIdx] ?? "";
						const coloredLine = inSel ? theme.fg("accent", rawLine) : rawLine;
						const lnStr = theme.fg("dim", String(lineIdx + 1).padStart(numWidth));
						out.push(twoColRow(sidebarLines[i], cursorMark(lineIdx), lnStr, commentMark(lineIdx), coloredLine));
					}

					out.push(splitFooterRule);

					const commentAtCursor = comments.find(c => cursorLine >= c.lineStart && cursorLine <= c.lineEnd);
					const summary = commentAtCursor
						? theme.fg("success", "● ") + theme.fg("accent", commentAtCursor.anchor + ": ") + theme.fg("muted", commentAtCursor.text)
						: comments.length > 0
							? theme.fg("muted", `${comments.length} comment(s) — `) + comments.map(() => theme.fg("success", "●")).join("")
							: theme.fg("dim", "No comments — v select · c annotate");

					const scrollInfo =
						mdLines.length > maxVisible ? `  ${scrollOffset + 1}-${end}/${mdLines.length}` : "";
					const hintLine = theme.fg("dim", `j/k cursor · [/] section · / search · v select · c annotate · d del · y copy · s submit · a accept · esc close${scrollInfo}`);

					if (mode === "edit") {
						out.push(rule());
						out.push(row(theme.fg("accent", "Comment: ") + theme.fg("muted", pendingAnchor)));
						for (const l of editor.render(inner)) out.push(row(l));
						out.push(rule());
						out.push(row(theme.fg("dim", "enter save · empty → delete · esc back")));
						out.push(border(`└${"─".repeat(width - 2)}┘`));
					} else {
						out.push(row(summary));
						out.push(row(hintLine));
						out.push(border(`└${"─".repeat(width - 2)}┘`));
					}
					return out;
				},

				invalidate(): void {
					mdTheme = getMarkdownTheme();
					md = new Markdown(plan, 0, 0, mdTheme);
				},

				handleInput(data: string): void {
					if (mode === "pick") {
						if (data === "j") selectList?.handleInput("\x1b[B");
						else if (data === "k") selectList?.handleInput("\x1b[A");
						else if (data === "l") selectList?.handleInput("\r");
						else selectList?.handleInput(data);
						requestRender();
						return;
					}

					if (mode === "edit") {
						if (matchesKey(data, Key.escape)) {
							editor.setText("");
							mode = "view";
							requestRender();
							return;
						}
						editor.handleInput(data);
						requestRender();
						return;
					}

					if (mode === "confirm") {
						if (data === "y" || data === "Y") {
							done({ action: "close" });
							return;
						}
						mode = "view";
						requestRender();
						return;
					}

					// view mode
					if (matchesKey(data, Key.escape) || matchesKey(data, "alt+p")) {
						countBuffer = "";
						pendingG = false;
						if (selectionStart !== null) {
							selectionStart = null;
							requestRender();
							return;
						}
						if (comments.length > 0) {
							mode = "confirm";
							requestRender();
						} else {
							done({ action: "close" });
						}
						return;
					}

					// Digits accumulate count prefix
					if (/^\d$/.test(data)) {
						countBuffer += data;
						requestRender();
						return;
					}
					const hadCount = countBuffer.length > 0;
					const count = hadCount ? parseInt(countBuffer, 10) : 1;
					countBuffer = "";

					// g / gg → top
					if (data === "g") {
						if (pendingG) { cursorLine = 0; scrollOffset = 0; pendingG = false; requestRender(); }
						else { pendingG = true; }
						return;
					}
					pendingG = false;

					const maxVisible = viewportRows(tui);

					// G / ctrl+g → bottom (or jump to line `count` if count was typed)
					if (data === "G" || matchesKey(data, "ctrl+g")) {
						cursorLine = !hadCount
							? Math.max(0, mdLines.length - 1)
							: Math.min(count - 1, Math.max(0, mdLines.length - 1));
						scrollOffset = !hadCount
							? Math.max(0, mdLines.length - maxVisible)
							: Math.min(count - 1, Math.max(0, mdLines.length - maxVisible));
						requestRender();
						return;
					}
					if (data === "[") {
						const idx = activeSectionIdx(headings, scrollOffset);
						const newLine = idx > 0 ? headings[idx - 1].approxLine : 0;
						cursorLine = newLine;
						scrollOffset = newLine;
						requestRender();
						return;
					}
					if (data === "]") {
						const idx = activeSectionIdx(headings, scrollOffset);
						if (idx < headings.length - 1) {
							cursorLine = headings[idx + 1].approxLine;
							scrollOffset = Math.min(headings[idx + 1].approxLine, Math.max(0, mdLines.length - maxVisible));
						}
						requestRender();
						return;
					}
					if (data === "j" || matchesKey(data, Key.down)) {
						cursorLine = Math.min(cursorLine + count, Math.max(0, mdLines.length - 1));
						if (cursorLine >= scrollOffset + maxVisible) scrollOffset = cursorLine - maxVisible + 1;
						if (cursorLine < scrollOffset) scrollOffset = cursorLine;
						requestRender();
						return;
					}
					if (data === "k" || matchesKey(data, Key.up)) {
						cursorLine = Math.max(cursorLine - count, 0);
						if (cursorLine < scrollOffset) scrollOffset = cursorLine;
						if (cursorLine >= scrollOffset + maxVisible) scrollOffset = cursorLine - maxVisible + 1;
						requestRender();
						return;
					}
					if (matchesKey(data, Key.home)) {
						cursorLine = 0;
						scrollOffset = 0;
						requestRender();
						return;
					}
					if (matchesKey(data, Key.end)) {
						cursorLine = Math.max(0, mdLines.length - 1);
						scrollOffset = Math.max(0, mdLines.length - maxVisible);
						requestRender();
						return;
					}
					if (data === "v" || data === "V") {
						selectionStart = selectionStart === null ? cursorLine : null;
						requestRender();
						return;
					}
					if (data === "d" || data === "D") {
						const idx = comments.findIndex(c => cursorLine >= c.lineStart && cursorLine <= c.lineEnd);
						if (idx >= 0) { comments.splice(idx, 1); requestRender(); }
						return;
					}
					if (data === "c" || data === "C") {
						const lineStart = selectionStart !== null ? Math.min(selectionStart, cursorLine) : cursorLine;
						const lineEnd   = selectionStart !== null ? Math.max(selectionStart, cursorLine) : cursorLine;
						const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
						const firstLine = stripAnsi(mdLines[lineStart] ?? "").replace(/^#+\s*/, "").trim();
						const lineRange = lineStart === lineEnd
							? `line ${lineStart + 1}`
							: `lines ${lineStart + 1}–${lineEnd + 1}`;
						pendingLineStart = lineStart;
						pendingLineEnd = lineEnd;
						pendingAnchor = `${lineRange}: ${firstLine}`.slice(0, 80);
						const existing = comments.find(c => c.lineStart === lineStart && c.lineEnd === lineEnd);
						editor.setText(existing?.text ?? "");
						selectionStart = null;
						mode = "edit";
						requestRender();
						return;
					}
					if (data === "/") {
						openNavPicker();
						return;
					}
					if (data === "y" || data === "Y") {
						if (planFile) {
							const b64 = Buffer.from(planFile).toString("base64");
							process.stdout.write(`\x1b]52;c;${b64}\x07`);
							ctx.ui.notify("Plan path copied to clipboard.", "info");
						}
						return;
					}
					if (data === "s" || data === "S") {
						if (comments.length === 0) return;
						void (async () => {
							const result = await openSubmitModal(ctx, comments);
							if (result === "submit") done({ action: "submit", comments: [...comments] });
						})();
						return;
					}
					if (data === "a" || data === "A") {
						if (modelSelectorOpen) return;
						modelSelectorOpen = true;
						void (async () => {
							try {
								const model = await openModelSelector(ctx);
								if (!model) return;
								const choice = await openExecutionMenu(ctx, model);
								if (!choice || choice === "back") return;
								done({ action: "accept", model, newSession: choice === "new" });
							} finally {
								modelSelectorOpen = false;
							}
						})();
						return;
					}
				},

				dispose(): void {
					editor.dispose();
				},
			};
		},
		{
			overlay: true,
			overlayOptions: { width: "95%", maxHeight: "98%", anchor: "center", minWidth: 60 },
		},
	);
}

// ─── Model Selection ──────────────────────────────────────────────────────────

async function openModelSelector(ctx: any): Promise<string | null> {
	const available: any[] = await ctx.modelRegistry.getAvailable();
	const currentLabel = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : null;

	const items: SelectItem[] = available.map((m: any) => {
		const label = `${m.provider}/${m.id}`;
		return {
			value: label,
			label: m.label ?? m.id,
			description: m.provider + (label === currentLabel ? "  · current" : ""),
		};
	});

	return ctx.ui.custom<string | null>(
		(tui: any, theme: any, _kb: any, done: (r: string | null) => void) => {
			let searchQuery = "";
			let filteredItems = [...items];
			let searching = false;

			const buildList = () => {
				const sl = new SelectList(filteredItems, Math.min(Math.max(filteredItems.length, 1), 12), {
					selectedPrefix: (t: string) => theme.fg("accent", t),
					selectedText: (t: string) => theme.fg("accent", t),
					description: (t: string) => theme.fg("muted", t),
					scrollInfo: (t: string) => theme.fg("dim", t),
					noMatch: (t: string) => theme.fg("warning", t),
				});
				sl.onSelect = (item: SelectItem) => done(item.value);
				sl.onCancel = () => done(null);
				return sl;
			};

			let selectList = buildList();

			const updateFilter = (q: string) => {
				searchQuery = q;
				const ql = q.toLowerCase();
				filteredItems = q
					? items.filter(i => i.label.toLowerCase().includes(ql) || i.value.toLowerCase().includes(ql))
					: [...items];
				selectList = buildList();
			};

			return {
				render(w: number): string[] {
					const border = (s: string) => theme.fg("border", s);
					const inner = w - 4;
					const out: string[] = [];
					const row = (content: string) => {
						const clipped = truncateToWidth(content, inner);
						const pad = Math.max(0, inner - visibleWidth(clipped));
						return border("│ ") + clipped + " ".repeat(pad) + border(" │");
					};

					out.push(border(`┌${"─".repeat(w - 2)}┐`));
					const searchDisplay = searching
						? theme.fg("accent", `/${searchQuery}`) + theme.fg("dim", "█")
						: searchQuery
							? theme.fg("accent", `/${searchQuery}`) + theme.fg("dim", "  · / to edit")
							: theme.fg("dim", "/ to search");
					out.push(row(
						theme.fg("accent", theme.bold("Select model:")) +
						theme.fg("muted", "  ") + searchDisplay,
					));
					out.push(border(`├${"─".repeat(w - 2)}┤`));
					for (const l of selectList.render(inner)) out.push(row(l));
					out.push(border(`├${"─".repeat(w - 2)}┤`));
					const hint = searching
						? theme.fg("dim", "type to filter · backspace clear · enter/esc done")
						: theme.fg("dim", "j/k navigate · l/enter select · / search · esc cancel");
					out.push(row(hint));
					out.push(border(`└${"─".repeat(w - 2)}┘`));
					return out;
				},

				invalidate() {},

				handleInput(data: string) {
					if (searching) {
						if (matchesKey(data, Key.escape) || data === "\r") {
							searching = false;
						} else if (data === "\x7f" || data === "\x08") {
							updateFilter(searchQuery.slice(0, -1));
						} else if (data.length === 1 && data.charCodeAt(0) >= 32) {
							updateFilter(searchQuery + data);
						}
					} else {
						if (data === "/") {
							searching = true;
						} else if (data === "j") {
							selectList.handleInput("\x1b[B");
						} else if (data === "k") {
							selectList.handleInput("\x1b[A");
						} else if (data === "l") {
							selectList.handleInput("\r");
						} else {
							selectList.handleInput(data);
						}
					}
					tui.requestRender();
				},
			};
		},
		{ overlay: true, overlayOptions: { width: "55%", maxHeight: "80%", anchor: "center", minWidth: 50 } },
	);
}

// ─── Execution Menu ───────────────────────────────────────────────────────────

type ExecutionChoice = "new" | "current" | "back";

async function openExecutionMenu(ctx: any, modelLabel: string): Promise<ExecutionChoice | null> {
	const items: SelectItem[] = [
		{ value: "new",     label: "New session",     description: "Clear context · plan sent as first message" },
		{ value: "current", label: "Current session", description: "Keep context · plan placed in editor" },
		{ value: "back",    label: "Go back",         description: "Return to plan overlay" },
	];
	return ctx.ui.custom<ExecutionChoice | null>(
		(tui: any, theme: any, _kb: any, done: (r: ExecutionChoice | null) => void) => {
			const container = new Container();
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			container.addChild(new Text(
				theme.fg("accent", theme.bold("Execute plan with: ")) + theme.fg("dim", modelLabel),
				1, 0,
			));
			const selectList = new SelectList(items, 3, {
				selectedPrefix: (t: string) => theme.fg("accent", t),
				selectedText: (t: string) => theme.fg("accent", t),
				description: (t: string) => theme.fg("muted", t),
				scrollInfo: (t: string) => theme.fg("dim", t),
				noMatch: (t: string) => theme.fg("warning", t),
			});
			selectList.onSelect = (item: SelectItem) => done(item.value as ExecutionChoice);
			selectList.onCancel = () => done(null);
			container.addChild(selectList);
			container.addChild(new Text(
				theme.fg("dim", "j/k navigate · enter/l select · n new · c current · b/esc back"),
				1, 0,
			));
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			return {
				render: (w: number) => container.render(w),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => {
					if (data === "j") selectList.handleInput("\x1b[B");
					else if (data === "k") selectList.handleInput("\x1b[A");
					else if (data === "l") selectList.handleInput("\r");
					else if (data === "n") done("new");
					else if (data === "c") done("current");
					else if (data === "b") done("back");
					else selectList.handleInput(data);
					tui.requestRender();
				},
			};
		},
		{ overlay: true, overlayOptions: { width: "48%", maxHeight: "35%", anchor: "center", minWidth: 52 } },
	);
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export default function inlinePlanExtension(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let handoffPending = false;
	let currentGoal = "";
	let latestPlan = "";
	let latestPlanFile = "";
	let savedTools: string[] = [];
	let pendingHandoff: { plan: string; model: string | null; goal: string } | null = null;
	let onPlanRefreshCallback: (() => void) | null = null;

	function persistState(): void {
		pi.appendEntry("inline-plan", { enabled: planModeEnabled, goal: currentGoal });
	}

	function updateStatus(ctx: ExtensionContext): void {
		if (planModeEnabled) {
			const hint = latestPlan ? "Alt+P to review" : currentGoal ? "exploring…" : "describe your goal";
			const goal = currentGoal.length > 50 ? currentGoal.slice(0, 47) + "…" : currentGoal || "(no goal yet)";
			ctx.ui.setStatus("inline-plan", ctx.ui.theme.fg("warning", `⏸ plan · ${hint}`));
			ctx.ui.setWidget("inline-plan", [
				ctx.ui.theme.fg("warning", "⏸ PLAN MODE") +
				ctx.ui.theme.fg("muted", `  ${goal}`) +
				ctx.ui.theme.fg("dim", `  · ${hint}`),
			]);
		} else {
			ctx.ui.setStatus("inline-plan", undefined);
			ctx.ui.setWidget("inline-plan", undefined);
		}
	}

	function toolNames(tools: unknown[]): string[] {
		return tools.map((t: any) => (typeof t === "string" ? t : t.name)).filter(Boolean);
	}

	function enablePlanMode(ctx: ExtensionContext, goal: string): void {
		if (!planModeEnabled) {
			savedTools = toolNames(pi.getActiveTools());
			pi.setActiveTools(PLAN_MODE_TOOLS);
		}
		planModeEnabled = true;
		currentGoal = goal;
		latestPlan = "";
		latestPlanFile = "";
		updateStatus(ctx);
		persistState();
	}

	function disablePlanMode(ctx: ExtensionContext): void {
		if (!planModeEnabled) return;
		planModeEnabled = false;
		if (savedTools.length > 0) pi.setActiveTools(savedTools);
		latestPlan = "";
		latestPlanFile = "";
		currentGoal = "";
		updateStatus(ctx);
		persistState();
	}

	async function acceptAndHandoff(ctx: any, plan: string, selectedModel: string | null, newSession: boolean): Promise<void> {
		if (selectedModel && ctx.model) {
			const currentLabel = `${ctx.model.provider}/${ctx.model.id}`;
			if (selectedModel !== currentLabel) {
				const slash = selectedModel.indexOf("/");
				if (slash > 0) {
					const model = ctx.modelRegistry.find(selectedModel.slice(0, slash), selectedModel.slice(slash + 1));
					if (model) await pi.setModel(model);
					else ctx.ui.notify(`Model not found: ${selectedModel} (keeping current)`, "warning");
				}
			}
		}

		if (newSession) {
			// ctx.newSession is only available on ExtensionCommandContext, not shortcut context.
			// Store the handoff and pre-fill the editor with /plan execute so the user can
			// submit it from a command handler that has access to ctx.newSession.
			pendingHandoff = { plan, model: selectedModel, goal: currentGoal };
			handoffPending = true;
			disablePlanMode(ctx);
			ctx.ui.setEditorText("/plan execute");
			ctx.ui.notify("Press Enter to open plan in a new session.", "info");
			return;
		}

		const planFile = latestPlanFile || savePlanFile(plan, currentGoal);
		handoffPending = true;
		disablePlanMode(ctx);

		const seed =
			`Execute the following implementation plan. It is self-contained — rely only on ` +
			`this plan and the codebase. Plan also saved at: ${planFile}\n\n${plan}`;

		ctx.ui.setEditorText(seed);
		ctx.ui.notify(`Plan saved → ${planFile}. Review, then submit to execute.`, "info");
	}

	// ── write_plan tool ───────────────────────────────────────────────────────
	pi.registerTool({
		name: "write_plan",
		label: "Write Plan",
		description: "Save or update the implementation plan. Call this to submit a new plan or any revision. Do NOT print the plan inline in chat.",
		promptSnippet: "write_plan — save/update the current plan to disk",
		promptGuidelines: [
			"Call write_plan to submit the plan — do NOT print the full plan inline in chat",
			"Call write_plan again each time you revise based on user feedback",
		],
		parameters: Type.Object({
			plan: Type.String({ description: "The complete markdown plan content" }),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			const lines = (params.plan ?? "").split("\n").length;
			onUpdate?.({ content: [{ type: "text", text: `Saving plan (${lines} lines)…` }], details: {} });
			latestPlan = params.plan;
			latestPlanFile = savePlanFile(params.plan, currentGoal);
			updateStatus(ctx as any);
			persistState();
			onPlanRefreshCallback?.();
			onPlanRefreshCallback = null;
			return {
				content: [{ type: "text", text: `Plan saved → ${latestPlanFile.replace(homedir(), "~")}. Use Alt+P to review.` }],
				details: { plan: params.plan, file: latestPlanFile },
			};
		},
		renderCall(args, theme, _context) {
			const lines = ((args as any).plan ?? "").split("\n").length;
			return new Text(
				theme.fg("toolTitle", theme.bold("write_plan")) + " " +
				theme.fg("muted", `saving plan · ${lines} lines`),
				0, 0,
			);
		},
		renderResult(result, _opts, theme, _context) {
			const details = result.details as { file?: string };
			const path = (details?.file ?? "").replace(homedir(), "~");
			return new Text(theme.fg("success", `Plan saved → ${path}`), 0, 0);
		},
	});

	// ── /plan command ──────────────────────────────────────────────────────────
	pi.registerCommand("plan", {
		description: "Plan mode: the agent drafts a reviewable plan, then hands off to a fresh executor",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/plan requires interactive mode", "error");
				return;
			}
			const goal = args.trim();

			// /plan execute — complete a pending new-session handoff using command context
			if (goal === "execute") {
				if (!pendingHandoff) {
					ctx.ui.notify("No pending handoff.", "error");
					return;
				}
				const { plan, model: m, goal: g } = pendingHandoff;
				pendingHandoff = null;

				if (m && ctx.model) {
					const currentLabel = `${ctx.model.provider}/${ctx.model.id}`;
					if (m !== currentLabel) {
						const slash = m.indexOf("/");
						if (slash > 0) {
							const foundModel = ctx.modelRegistry.find(m.slice(0, slash), m.slice(slash + 1));
							if (foundModel) await pi.setModel(foundModel);
							else ctx.ui.notify(`Model not found: ${m} (keeping current)`, "warning");
						}
					}
				}

				const planFile = savePlanFile(plan, g);
				const seed =
					`Execute the following implementation plan. It is self-contained — rely only on ` +
					`this plan and the codebase. Plan also saved at: ${planFile}\n\n${plan}`;

				await ctx.newSession({
					withSession: async (newCtx: any) => {
						await newCtx.sendUserMessage(seed);
					},
				});
				return;
			}

			if (planModeEnabled && !goal) {
				disablePlanMode(ctx);
				ctx.ui.notify("Plan mode off — full tool access restored.", "info");
				return;
			}
			if (!goal) {
				enablePlanMode(ctx, "");
				ctx.ui.notify("Plan mode on. Describe what you want to build.", "info");
				return;
			}
			enablePlanMode(ctx, goal);
			ctx.ui.notify("Plan mode on — agent is exploring. Press Alt+P to review once a plan is drafted.", "info");
			pi.sendUserMessage(goal);
		},
	});

	// ── Toggle the plan review overlay ───────────────────────────────────────────
	pi.registerShortcut(TOGGLE_SHORTCUT, {
		description: "Review the current plan (inline-plan) — Alt+P",
		handler: async (ctx) => {
			if (!planModeEnabled) {
				ctx.ui.notify("Not in plan mode. Start with /plan <goal>.", "info");
				return;
			}
			if (!latestPlan) {
				ctx.ui.notify("No plan yet — let the agent finish drafting.", "info");
				return;
			}
			if (!latestPlanFile && latestPlan) latestPlanFile = savePlanFile(latestPlan, currentGoal);
			const result = await openPlanOverlay(ctx, latestPlan, currentGoal, latestPlanFile);
			if (!result || result.action === "close") return;

			if (result.action === "submit") {
				const refine = composeRefine(result.comments);
				const planUpdated = new Promise<void>(resolve => {
					onPlanRefreshCallback = resolve;
				});
				try {
					pi.sendUserMessage(refine);
				} catch {
					// Agent is mid-stream — queue the refinement until it finishes its tools.
					pi.sendUserMessage(refine, { deliverAs: "followUp" });
				}
				await ctx.ui.custom<void>((tui, theme, _kb, done) => {
					const loader = new BorderedLoader(tui, theme, "Reviewing comments…");
					loader.onAbort = () => done(undefined);
					planUpdated.then(() => done(undefined));
					return loader;
				});
				ctx.ui.notify("Plan updated — Alt+P to review.", "info");
			} else if (result.action === "accept") {
				await acceptAndHandoff(ctx, latestPlan, result.model, result.newSession);
			}
		},
	});

	// ── Inject the planning directive while in plan mode ─────────────────────────
	pi.on("before_agent_start", async () => {
		if (!planModeEnabled) return;
		return {
			message: {
				customType: "inline-plan-context",
				content: planDirective(currentGoal),
				display: false,
			},
		};
	});

	// ── Strip stale planning directives once plan mode is off ────────────────────
	pi.on("context", async (event) => {
		if (planModeEnabled) return;
		if (handoffPending) {
			handoffPending = false;
			return { messages: [] };
		}
		return {
			messages: event.messages.filter((m: any) => m.customType !== "inline-plan-context"),
		};
	});

	// ── Restore plan-mode state on session start / resume ────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();
		const entry = entries
			.filter((e: any) => e.type === "custom" && e.customType === "inline-plan")
			.pop() as { data?: { enabled?: boolean; goal?: string } } | undefined;

		if (entry?.data) {
			planModeEnabled = entry.data.enabled ?? false;
			currentGoal = entry.data.goal ?? "";
		}

		if (planModeEnabled) {
			const branchEntries = ctx.sessionManager.getBranch();
			// Primary: reconstruct from write_plan tool results
			for (const e of branchEntries) {
				if (e.type === "message" && (e.message as any).role === "toolResult" &&
						(e.message as any).toolName === "write_plan") {
					const plan = (e.message as any).details?.plan;
					if (plan) latestPlan = plan;
				}
			}
			// Fallback: old inline-marker format
			if (!latestPlan) {
				const branchMessages = branchEntries
					.filter((e: any) => e.type === "message")
					.map((e: any) => e.message as AgentMessage);
				const plan = extractPlanFromMessages(branchMessages);
				if (plan) latestPlan = plan;
			}

			savedTools = toolNames(pi.getActiveTools());
			pi.setActiveTools(PLAN_MODE_TOOLS);
		}

		updateStatus(ctx);
	});
}
