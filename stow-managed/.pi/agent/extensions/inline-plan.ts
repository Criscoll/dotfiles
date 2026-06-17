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
 *                      p  preview all comments
 *                      s  submit comments  -> sends a refine message; agent revises
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

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, TextContent } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
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
const PLAN_MODE_TOOLS = ["read", "bash", "grep", "find", "ls", "questionnaire"];

const TOGGLE_SHORTCUT = "alt+p";

// ─── Planning Directive ───────────────────────────────────────────────────────

function planDirective(goal: string): string {
	return `[PLAN MODE ACTIVE]
You are in plan mode: a read-only planning phase. Do NOT modify files or run mutating commands.

Goal:
${goal}

Your job:
1. Explore the codebase as needed (read-only tools only).
2. Produce ONE comprehensive, self-contained implementation plan. It will be handed to a
   FRESH agent with no prior context, so it must be executable from the plan + codebase alone.
3. Treat every subsequent user message as a refinement request and revise the plan.

Output rules (critical):
- Emit the COMPLETE plan wrapped exactly between ${PLAN_START} and ${PLAN_END} on their own lines.
- Re-emit the ENTIRE updated plan every time you revise — never a diff or a partial plan.
- Use this markdown structure:

${PLAN_START}
# Plan: <short title>

## Context
<relevant findings and constraints>

## Steps
1. **<step title>** — what to do and why. Files: path/a.ts, path/b.ts
2. **<step title>** — ...

## Verification
- how to test / verify the change end to end
${PLAN_END}

You may write a short explanation before the plan block, but the authoritative plan must
live between the markers.`;
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
	/** First ~50 chars of the first selected line (display label). */
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
		`Refine the plan based on these review comments. Then re-emit the COMPLETE updated ` +
		`plan between the ${PLAN_START} / ${PLAN_END} markers.\n\nComments:\n${body}`
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
	| { action: "accept" }
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

// ─── Plan Overlay ─────────────────────────────────────────────────────────────

function openPlanOverlay(ctx: any, plan: string, goal: string, planFile: string): Promise<OverlayResult | null> {
	return ctx.ui.custom<OverlayResult | null>(
		(tui: any, theme: any, _kb: any, done: (r: OverlayResult | null) => void) => {
			let mdTheme = getMarkdownTheme();
			let md = new Markdown(plan, 0, 0, mdTheme);
			const comments: Comment[] = [];

			let mode: "view" | "pick" | "edit" | "preview" | "confirm" = "view";
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

					if (mode === "edit") {
						out.push(rule());
						out.push(row(theme.fg("accent", "Comment on: ") + theme.fg("muted", pendingAnchor)));
						for (const l of editor.render(inner)) out.push(row(l));
						out.push(rule());
						out.push(row(theme.fg("dim", "normal text · enter save · empty → delete · esc back")));
						out.push(border(`└${"─".repeat(width - 2)}┘`));
						return out;
					}

					if (mode === "preview") {
						out.push(rule());
						if (comments.length === 0) {
							out.push(row(theme.fg("dim", "No comments yet.")));
						} else {
							for (const c of comments) {
								out.push(row(theme.fg("accent", `[${c.anchor}]`)));
								out.push(row(theme.fg("muted", `  ${c.text}`)));
							}
						}
						out.push(rule());
						out.push(row(theme.fg("dim", "p/esc close preview")));
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

					// view mode — two-column layout: sidebar | gutter | main
					const SB = 28;
					const mainW = Math.max(20, inner - SB - 3); // SB + divider(1) + gutter(2)
					mdLines = md.render(mainW);
					const maxVisible = viewportRows(tui);
					scrollOffset = Math.min(scrollOffset, Math.max(0, mdLines.length - maxVisible));
					cursorLine = Math.min(cursorLine, Math.max(0, mdLines.length - 1));
					const end = Math.min(scrollOffset + maxVisible, mdLines.length);

					headings = buildHeadingMap(plan, mdLines.length);
					const activeIdx = activeSectionIdx(headings, scrollOffset);
					const sidebarLines = renderSidebar(headings, activeIdx, maxVisible, SB, theme);

					// ├──SB+1──┬──gutter(2)+mainW+1──┤
					const splitHeaderRule = border(`├${"─".repeat(SB + 1)}┬${"─".repeat(mainW + 3)}┤`);
					const splitFooterRule = border(`├${"─".repeat(SB + 1)}┴${"─".repeat(mainW + 3)}┤`);

					out.push(splitHeaderRule);

					const gutterChar = (lineIdx: number): string => {
						const isCursor = lineIdx === cursorLine;
						const inSel = selectionStart !== null &&
							lineIdx >= Math.min(selectionStart, cursorLine) &&
							lineIdx <= Math.max(selectionStart, cursorLine);
						const hasComment = comments.some(c => lineIdx >= c.lineStart && lineIdx <= c.lineEnd);
						const mark = isCursor ? "▶" : (inSel ? "│" : " ");
						return mark + (hasComment ? "●" : " ");
					};

					const twoColRow = (sidebarLine: string, gutter: string, mainContent: string) => {
						const clipped = truncateToWidth(mainContent, mainW);
						const pad = Math.max(0, mainW - visibleWidth(clipped));
						return border("│ ") + sidebarLine + border("│") + gutter + clipped + " ".repeat(pad) + border(" │");
					};

					for (let i = 0; i < maxVisible; i++) {
						const lineIdx = scrollOffset + i;
						const inSel = selectionStart !== null &&
							lineIdx >= Math.min(selectionStart, cursorLine) &&
							lineIdx <= Math.max(selectionStart, cursorLine);
						const rawLine = mdLines[lineIdx] ?? "";
						const coloredLine = inSel ? theme.fg("accent", rawLine) : rawLine;
						out.push(twoColRow(sidebarLines[i], gutterChar(lineIdx), coloredLine));
					}

					out.push(splitFooterRule);

					const commentAtCursor = comments.find(c => cursorLine >= c.lineStart && cursorLine <= c.lineEnd);
					const summary = commentAtCursor
						? theme.fg("success", "● ") + theme.fg("accent", commentAtCursor.anchor + ": ") + theme.fg("muted", commentAtCursor.text)
						: comments.length > 0
							? theme.fg("muted", `${comments.length} comment(s) — `) + comments.map(() => theme.fg("success", "●")).join("") + theme.fg("dim", "  p to preview")
							: theme.fg("dim", "No comments — v select · c annotate · p preview");

					const scrollInfo =
						mdLines.length > maxVisible ? `  ${scrollOffset + 1}-${end}/${mdLines.length}` : "";
					out.push(row(summary));
					out.push(
						row(theme.fg("dim", `j/k cursor · [ ] section · / search · v select · c annotate · p preview · y path · s submit · a accept · esc/alt+p close${scrollInfo}`)),
					);
					out.push(border(`└${"─".repeat(width - 2)}┘`));
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

					if (mode === "preview") {
						if (data === "p" || data === "P" || matchesKey(data, Key.escape)) {
							mode = "view";
							requestRender();
						}
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
					if (data === "c" || data === "C") {
						const lineStart = selectionStart !== null ? Math.min(selectionStart, cursorLine) : cursorLine;
						const lineEnd   = selectionStart !== null ? Math.max(selectionStart, cursorLine) : cursorLine;
						const rawAnchor = mdLines[lineStart]?.replace(/^#+\s*/, "").trim() ?? `line ${lineStart}`;
						pendingLineStart = lineStart;
						pendingLineEnd = lineEnd;
						pendingAnchor = rawAnchor.slice(0, 50);
						const existing = comments.find(c => c.lineStart === lineStart && c.lineEnd === lineEnd);
						editor.setText(existing?.text ?? "");
						selectionStart = null;
						mode = "edit";
						requestRender();
						return;
					}
					if (data === "p" || data === "P") {
						mode = "preview";
						requestRender();
						return;
					}
					if (data === "/") {
						openNavPicker();
						return;
					}
					if (data === "y" || data === "Y") {
						if (planFile) {
							ctx.ui.setEditorText(planFile);
							ctx.ui.notify("Plan path in editor — close overlay to copy.", "info");
						}
						return;
					}
					if (data === "s" || data === "S") {
						if (comments.length > 0) done({ action: "submit", comments });
						return;
					}
					if (data === "a" || data === "A") {
						done({ action: "accept" });
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

async function modelSelectionPhase(ctx: any): Promise<string | null> {
	const available: any[] = await ctx.modelRegistry.getAvailable();
	const currentModel = ctx.model;
	const currentLabel = currentModel ? `${currentModel.provider}/${currentModel.id}` : null;

	if (!available.length) return currentLabel;

	const items: SelectItem[] = available.map((m: any) => {
		const label = `${m.provider}/${m.id}`;
		return {
			value: label,
			label: m.label ?? m.id,
			description: m.provider + (label === currentLabel ? "  (current)" : ""),
		};
	});

	const result = await ctx.ui.custom<string | null>(
		(tui: any, theme: any, _kb: any, done: (v: string | null) => void) => {
			const container = new Container();
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			container.addChild(
				new Text(theme.fg("accent", theme.bold("Select Model for New Session")), 1, 0),
			);

			const selectList = new SelectList(items, Math.min(items.length, 12), {
				selectedPrefix: (t: string) => theme.fg("accent", t),
				selectedText: (t: string) => theme.fg("accent", t),
				description: (t: string) => theme.fg("muted", t),
				scrollInfo: (t: string) => theme.fg("dim", t),
				noMatch: (t: string) => theme.fg("warning", t),
			});

			selectList.onSelect = (item: SelectItem) => done(item.value);
			selectList.onCancel = () => done(null);

			container.addChild(selectList);
			container.addChild(new Text(theme.fg("dim", "/ type to search · j/k navigate · l/enter select · esc cancel"), 1, 0));
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

			return {
				render: (w: number) => container.render(w),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => {
					if (data === "j") selectList.handleInput("\x1b[B");
					else if (data === "k") selectList.handleInput("\x1b[A");
					else if (data === "l") selectList.handleInput("\r");
					else selectList.handleInput(data);
					tui.requestRender();
				},
			};
		},
		{ overlay: true },
	);

	return result;
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export default function inlinePlanExtension(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let handoffPending = false;
	let currentGoal = "";
	let latestPlan = "";
	let latestPlanFile = "";
	let savedTools: string[] = [];

	function persistState(): void {
		pi.appendEntry("inline-plan", { enabled: planModeEnabled, goal: currentGoal });
	}

	function updateStatus(ctx: ExtensionContext): void {
		if (planModeEnabled) {
			const hint = latestPlan ? "Alt+P to review" : "drafting…";
			const goal = currentGoal.length > 50 ? currentGoal.slice(0, 47) + "…" : currentGoal;
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

	async function acceptAndHandoff(ctx: any, plan: string): Promise<void> {
		const selected = await modelSelectionPhase(ctx);
		if (selected === null) return;

		if (selected && ctx.model) {
			const currentLabel = `${ctx.model.provider}/${ctx.model.id}`;
			if (selected !== currentLabel) {
				const slash = selected.indexOf("/");
				if (slash > 0) {
					const model = ctx.modelRegistry.find(selected.slice(0, slash), selected.slice(slash + 1));
					if (model) await pi.setModel(model);
					else ctx.ui.notify(`Model not found: ${selected} (keeping current)`, "warning");
				}
			}
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

	// ── /plan command ──────────────────────────────────────────────────────────
	pi.registerCommand("plan", {
		description: "Plan mode: the agent drafts a reviewable plan, then hands off to a fresh executor",
		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/plan requires interactive mode", "error");
				return;
			}
			const goal = args.trim();
			if (planModeEnabled && !goal) {
				disablePlanMode(ctx);
				ctx.ui.notify("Plan mode off — full tool access restored.", "info");
				return;
			}
			if (!goal) {
				ctx.ui.notify("Usage: /plan <goal>", "error");
				return;
			}
			enablePlanMode(ctx, goal);
			ctx.ui.notify("Plan mode on. Agent is drafting — press Ctrl+Shift+P to review.", "info");
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
				try {
					pi.sendUserMessage(refine);
				} catch {
					// Agent is mid-stream — queue the refinement until it finishes its tools.
					pi.sendUserMessage(refine, { deliverAs: "followUp" });
				}
				ctx.ui.notify(`Sent ${result.comments.length} comment(s). Watch the agent revise.`, "info");
			} else if (result.action === "accept") {
				await acceptAndHandoff(ctx, latestPlan);
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

	// ── Capture the latest plan after each agent response ────────────────────────
	pi.on("agent_end", async (event, ctx) => {
		if (!planModeEnabled) return;
		const plan = extractPlanFromMessages(event.messages as AgentMessage[]);
		if (plan) {
			latestPlan = plan;
			latestPlanFile = savePlanFile(latestPlan, currentGoal);
			updateStatus(ctx);
			persistState();
		}
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
			const branchMessages = ctx.sessionManager
				.getBranch()
				.filter((e: any) => e.type === "message")
				.map((e: any) => e.message as AgentMessage);
			const plan = extractPlanFromMessages(branchMessages);
			if (plan) latestPlan = plan;

			savedTools = toolNames(pi.getActiveTools());
			pi.setActiveTools(PLAN_MODE_TOOLS);
		}

		updateStatus(ctx);
	});
}
