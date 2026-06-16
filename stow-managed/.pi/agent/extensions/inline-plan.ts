/**
 * Inline Plan Extension
 *
 * Generates a structured plan from a goal, with annotation-based refinement,
 * model selection, and handoff to a new session.
 *
 * Usage:
 *   /plan <goal>
 *
 * Flow:
 *   1. Research: BorderedLoader + complete() generates initial plan
 *   2. Overlay: plan shown with Markdown + annotation input at bottom
 *   3. Annotate: Enter submits annotation → async re-complete → overlay updates
 *   4. Accept: Ctrl+A captures final plan → closes overlay
 *   5. Model select: separate overlay picks model (or keep current)
 *   6. Handoff: ctx.newSession() → setEditorText(plan) → setModel
 *
 * Single file, zero npm deps. Imports proven patterns from handoff.ts, qna.ts, preset.ts.
 */

import type { AgentMessage, SessionEntry } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { complete } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	BorderedLoader,
	convertToLlm,
	serializeConversation,
	getMarkdownTheme,
	DynamicBorder,
} from "@earendil-works/pi-coding-agent";
import {
	Container,
	type SelectItem,
	SelectList,
	Text,
	Markdown,
	matchesKey,
	Key,
	visibleWidth,
	CURSOR_MARKER,
} from "@earendil-works/pi-tui";

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a structured planning assistant. Given a conversation history and a user's goal, generate a detailed plan that lays out what to do, in what order, and why.

## Instructions

1. Analyze the conversation history for relevant context: decisions made, approaches discussed, files modified, pain points identified.
2. Understand the user's stated goal and how it relates to the existing context.
3. Produce a plan with:
   - A short title/header describing the plan
   - Numbered steps, each with a clear description of what to do
   - For each step: what to change, why, and potential risks or dependencies
   - Any files that need to be created or modified (if relevant)
   - Tests or verification steps (if relevant)

## Format

Use a clear hierarchical markdown structure. Example:

# Plan: [Short Title]

## Context
Brief summary of relevant context from the conversation (omit if no context exists).

## Steps
1. **Step one title** — What to do and why. Potential risks: ...
   - Files: path/to/file1.ts, path/to/file2.ts
2. **Step two title** — What to do and why.
   - Files: path/to/file3.ts

## Verification
- Steps to run tests, check types, or manually verify.

Be thorough but concise. Do not include any preamble — output the plan directly.`;

// ─── Context Gathering (same pattern as handoff.ts) ────────────────────────────

function entryToMessage(entry: SessionEntry): AgentMessage | undefined {
	if (entry.type === "message") return entry.message;
	if (entry.type === "compaction") {
		return {
			role: "compactionSummary",
			summary: entry.summary,
			tokensBefore: entry.tokensBefore,
			timestamp: new Date(entry.timestamp).getTime(),
		};
	}
	return undefined;
}

function getHandoffMessages(branch: SessionEntry[]): AgentMessage[] {
	let compactionIndex = -1;
	for (let i = branch.length - 1; i >= 0; i--) {
		if (branch[i].type === "compaction") {
			compactionIndex = i;
			break;
		}
	}
	if (compactionIndex < 0) {
		return branch.map(entryToMessage).filter((m): m is AgentMessage => m !== undefined);
	}
	const compaction = branch[compactionIndex];
	const firstKeptIndex =
		compaction.type === "compaction"
			? branch.findIndex((e) => e.id === compaction.firstKeptEntryId)
			: -1;
	const compactedBranch = [
		compaction,
		...(firstKeptIndex >= 0 ? branch.slice(firstKeptIndex, compactionIndex) : []),
		...branch.slice(compactionIndex + 1),
	];
	return compactedBranch.map(entryToMessage).filter((m): m is AgentMessage => m !== undefined);
}

// ─── Extension Entry Point ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerCommand("plan", {
		description: "Generate a structured plan from a goal",
		handler: async (args, ctx) => {
			// ── Guard: TUI only ───────────────────────────────────────────
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/plan requires interactive mode", "error");
				return;
			}

			// ── Guard: model available ─────────────────────────────────────
			if (!ctx.model) {
				ctx.ui.notify("No model selected", "error");
				return;
			}

			// ── Guard: non-empty goal ──────────────────────────────────────
			const goal = args.trim();
			if (!goal) {
				ctx.ui.notify("Usage: /plan <goal>", "error");
				return;
			}

			// ── Gather conversation context ────────────────────────────────
			const branch = ctx.sessionManager.getBranch();
			const messages = getHandoffMessages(branch);
			const llmMessages = convertToLlm(messages);
			const conversationText = serializeConversation(llmMessages);

			// ── Research Phase: Generate initial plan ──────────────────────
			const plan = await generatePlanPhase(ctx, goal, conversationText);
			if (plan === null) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			// ── Display + Annotation Loop (overlay) ───────────────────────
			const acceptedPlan = await planOverlayPhase(ctx, plan, goal, conversationText);
			if (acceptedPlan === null) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			// ── Model Selection ───────────────────────────────────────────
			const selectedModelStr = await modelSelectionPhase(ctx);

			// ── Handoff ───────────────────────────────────────────────────
			const currentSessionFile = ctx.sessionManager.getSessionFile();

			const newSessionResult = await ctx.newSession({
				parentSession: currentSessionFile,
				withSession: async (replacementCtx) => {
					replacementCtx.ui.setEditorText(acceptedPlan);

					// Apply selected model if different from current
					if (selectedModelStr && ctx.model) {
						const currentLabel = `${ctx.model.provider}/${ctx.model.id}`;
						if (selectedModelStr !== currentLabel) {
							const slashIdx = selectedModelStr.indexOf("/");
							if (slashIdx > 0) {
								const provider = selectedModelStr.slice(0, slashIdx);
								const modelId = selectedModelStr.slice(slashIdx + 1);
								const model = ctx.modelRegistry.find(provider, modelId);
								if (model) {
									await pi.setModel(model);
								}
							}
						}
					}

					replacementCtx.ui.notify("Plan loaded. Submit when ready.", "info");
				},
			});

			if (newSessionResult.cancelled) {
				ctx.ui.notify("New session cancelled", "info");
			}
		},
	});
}

// ─── Phase 1: Generate Initial Plan ───────────────────────────────────────────

async function generatePlanPhase(
	ctx: any,
	goal: string,
	conversationText: string,
): Promise<string | null> {
	return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const loader = new BorderedLoader(tui, theme, `Generating plan...`);
		loader.onAbort = () => done(null);

		const doGenerate = async () => {
			const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model!);
			if (!auth.ok || !auth.apiKey) {
				throw new Error(auth.ok ? `No API key for ${ctx.model!.provider}` : auth.error);
			}

			const userText =
				(conversationText.length > 0 ? `## Conversation History\n\n${conversationText}\n\n` : "") +
				`## User's Goal\n\n${goal}`;

			const userMessage: Message = {
				role: "user",
				content: [{ type: "text", text: userText }],
				timestamp: Date.now(),
			};

			const response = await complete(
				ctx.model!,
				{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
				{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
			);

			if (response.stopReason === "aborted") return null;

			return response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");
		};

		doGenerate()
			.then(done)
			.catch((err) => {
				console.error("Plan generation failed:", err);
				done(null);
			});

		return loader;
	});
}

// ─── Phase 2: Plan Overlay with Annotation Loop ───────────────────────────────

interface AnnotationItem {
	/** 0-indexed line number in the rendered markdown output */
	line: number;
	/** The annotation text */
	text: string;
}

async function planOverlayPhase(
	ctx: any,
	initialPlan: string,
	goal: string,
	conversationText: string,
): Promise<string | null> {
	// Called when user presses Ctrl+A with annotations to trigger replan.
	const replanWithLoader = async (
		currentPlan: string,
		annotations: AnnotationItem[],
	): Promise<string | null> => {
		return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const loader = new BorderedLoader(tui, theme, "Refining plan with annotations...");
			loader.onAbort = () => done(null);

			const doRefine = async () => {
				const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
				if (!auth.ok || !auth.apiKey) {
					throw new Error(auth.ok ? `No API key for ${ctx.model.provider}` : auth.error);
				}

				const annotationLines = annotations
					.map((a, i) => `${i + 1}. Line ${a.line + 1}: ${a.text}`)
					.join("\n");

				const userText =
					(conversationText.length > 0
						? `## Conversation History\n\n${conversationText}\n\n`
						: "") +
					`## Current Plan\n\n${currentPlan}\n\n` +
					`## Annotations\n\n` +
					`Refine the plan based on these line-specific annotations (line numbers refer ` +
					`to the rendered plan output):\n${annotationLines}`;

				const userMessage: Message = {
					role: "user",
					content: [{ type: "text", text: userText }],
					timestamp: Date.now(),
				};

				const response = await complete(
					ctx.model,
					{ systemPrompt: SYSTEM_PROMPT, messages: [userMessage] },
					{ apiKey: auth.apiKey, headers: auth.headers, signal: loader.signal },
				);

				if (response.stopReason === "aborted") return null;

				return response.content
					.filter((c): c is { type: "text"; text: string } => c.type === "text")
					.map((c) => c.text)
					.join("\n");
			};

			doRefine()
				.then(done)
				.catch(() => done(null));

			return loader;
		});
	};

	// Loop: show overlay → collect annotations → replan → re-open overlay → ...
	let currentPlan = initialPlan;

	while (true) {
		const result = await showPlanOverlay(ctx, currentPlan, replanWithLoader);

		if (result === null) {
			return null;
		}

		if (result.accepted) {
			return currentPlan;
		}

		if (result.newPlan !== null) {
			currentPlan = result.newPlan;
		}
	}
}

/**
 * Result from the plan overlay:
 * - `accepted: true` — user accepted plan as-is (Ctrl+A with no annotations)
 * - `accepted: false` + `newPlan: string | null` — annotations submitted and replanned
 */
interface PlanOverlayResult {
	accepted: boolean;
	newPlan?: string | null;
}

type PanelFocus = "plan" | "annotate";

async function showPlanOverlay(
	ctx: any,
	plan: string,
	replanFn: (currentPlan: string, annotations: AnnotationItem[]) => Promise<string | null>,
): Promise<PlanOverlayResult | null> {
	return ctx.ui.custom<PlanOverlayResult | null>(
		(tui, theme, _kb, done) => {
			let state: "showing" | "loading" = "showing";
			let mdTheme = getMarkdownTheme();
			let md = new Markdown(plan, 0, 0, mdTheme);

			// Plan panel
			let scrollOffset = 0;
			let cursorLine = 0;
			let cachedMdLines: string[] = [];

			// Annotation panel
			let annotationText = "";
			let annotationCursor = 0;
			let focus: PanelFocus = "plan";
			let annotations: AnnotationItem[] = [];

			const requestRender = () => tui.requestRender();

			const startReplan = () => {
				state = "loading";
				requestRender();

				replanFn(plan, annotations).then((newPlan) => {
					if (newPlan !== null) {
						md = new Markdown(newPlan, 0, 0, mdTheme);
					}
					annotationText = "";
					annotationCursor = 0;
					annotations = [];
					cursorLine = 0;
					scrollOffset = 0;
					focus = "plan";
					state = "showing";
					requestRender();

					done({ accepted: false, newPlan });
				});
			};

			// Split width: left panel gets ~55%, right gets the rest.
			const splitAt = (w: number) => {
				const left = Math.max(30, Math.floor(w * 0.55));
				const right = w - left - 1; // -1 for the vertical divider
				return { left, right };
			};

			return {
				render(width: number): string[] {
					const { left, right } = splitAt(width - 4); // -4 for outer borders
					const lines: string[] = [];

					// Top border
					lines.push(theme.fg("border", `┌${"─".repeat(width - 2)}┐`));
					const titleText = " Inline Plan ";
					const titleStyled = theme.fg("accent", theme.bold(titleText));
					lines.push(
						theme.fg("border", "│ ") +
							titleStyled +
							" ".repeat(Math.max(0, width - 4 - visibleWidth(titleStyled))) +
							theme.fg("border", "│"),
					);
					lines.push(theme.fg("border", `├${"─".repeat(width - 2)}┤`));

					if (state === "loading") {
						const spinner = theme.fg("accent", "⟳");
						const msg = theme.fg("muted", "Refining plan with annotations...");
						const line = ` ${spinner} ${msg}`;
						const innerW = width - 4;
						const padding = Math.max(0, innerW - visibleWidth(line));
						lines.push(
							theme.fg("border", "│ ") + line + " ".repeat(padding) + theme.fg("border", "│"),
						);
					} else {
						// ── Render plan lines ──
						cachedMdLines = md.render(left - 2); // -2 for inner left-panel padding
						const totalLines = cachedMdLines.length;
						const maxVisible = 18;
						const clampedOffset = Math.min(scrollOffset, Math.max(0, totalLines - maxVisible));
						const start = clampedOffset;
						const end = Math.min(start + maxVisible, totalLines);

						// Precompute which lines have annotations (for indicators)
						const annotatedLines = new Set(annotations.map((a) => a.line));

						// Render each visible row: plan on left | annotation info on right
						for (let i = start; i < end; i++) {
							const globalLine = i;
							const mdLine = cachedMdLines[i] ?? "";

							// Left side: plan line
							const isCursor = globalLine === cursorLine && focus === "plan";
							const hasAnnotation = annotatedLines.has(globalLine);
							const cursorMarker = isCursor ? theme.fg("accent", "▶ ") : "  ";
							const annotationMarker = hasAnnotation && !isCursor ? theme.fg("success", "● ") : "  ";
							const marker = isCursor ? cursorMarker : annotationMarker;
							const leftContent = marker + mdLine;
							const leftPadding = Math.max(0, left - visibleWidth(leftContent));

							// Right side: show annotation if present for this line, or context for cursor line
							let rightContent = "";
							if (hasAnnotation) {
								const ann = annotations.find((a) => a.line === globalLine)!;
								const preview =
									ann.text.length > right - 2 ? ann.text.slice(0, right - 5) + "..." : ann.text;
								rightContent = theme.fg("success", preview);
							} else if (isCursor && focus === "annotate") {
								rightContent = theme.fg("muted", "← annotating this line");
							}
							const rightPadding = Math.max(0, right - visibleWidth(rightContent));

							lines.push(
								theme.fg("border", "│ ") +
									leftContent +
									" ".repeat(leftPadding) +
									theme.fg("border", "│") +
									rightContent +
									" ".repeat(rightPadding) +
									theme.fg("border", "│"),
							);
						}

						// Fill remaining rows if < maxVisible
						const renderedRows = end - start;
						for (let i = renderedRows; i < maxVisible; i++) {
							lines.push(
								theme.fg("border", "│ ") +
									" ".repeat(left) +
									theme.fg("border", "│") +
									" ".repeat(right) +
									theme.fg("border", "│"),
							);
						}

						// Separator
						lines.push(
							theme.fg("border", "├─") +
								"─".repeat(left) +
								theme.fg("border", "┼") +
								"─".repeat(right) +
								theme.fg("border", "┤"),
						);

						// Annotation input row
						const focusLabel =
							focus === "annotate"
								? theme.fg("accent", ` Annotating line ${cursorLine + 1}: `)
								: theme.fg("muted", ` Annotations (${annotations.length}): `);

						if (focus === "annotate") {
							const before = annotationText.slice(0, annotationCursor);
							const atCursor =
								annotationCursor < annotationText.length
									? annotationText[annotationCursor] ?? " "
									: " ";
							const after = annotationText.slice(annotationCursor + 1);
							const inputContent = `${focusLabel}${before}${CURSOR_MARKER}\x1b[7m${atCursor}\x1b[27m${after}`;
							// Input spans both columns
							const fullWidth = left + right + 1;
							const padding = Math.max(0, fullWidth - visibleWidth(inputContent));
							lines.push(
								theme.fg("border", "│ ") +
									inputContent +
									" ".repeat(padding) +
									theme.fg("border", "│"),
							);
						} else {
							// Show annotation list preview
							let summaryLine = focusLabel;
							if (annotations.length > 0) {
								summaryLine += annotations
									.map((a) => theme.fg("success", `L${a.line + 1}`))
									.join(", ");
							} else {
								summaryLine += theme.fg("dim", "none yet");
							}
							const fullWidth = left + right + 1;
							const padding = Math.max(0, fullWidth - visibleWidth(summaryLine));
							lines.push(
								theme.fg("border", "│ ") +
									summaryLine +
									" ".repeat(padding) +
									theme.fg("border", "│"),
							);
						}

						// Help bar
						const scrollInfo =
							totalLines > maxVisible
								? ` ${start + 1}-${end}/${totalLines}`
								: "";
						const help =
							theme.fg("dim",
								focus === "plan"
									? ` ↑↓ navigate • Enter annotate line • Tab annotate panel • Ctrl+A submit • Esc cancel ${scrollInfo}`
									: ` Type annotation • Enter save • Tab/↑↓ plan panel • Esc cancel`,
							);
						const fullWidth = left + right + 1;
						const helpPadding = Math.max(0, fullWidth - visibleWidth(help));
						lines.push(
							theme.fg("border", "│ ") +
								help +
								" ".repeat(helpPadding) +
								theme.fg("border", "│"),
						);
					}

					// Bottom border
					lines.push(theme.fg("border", `└${"─".repeat(width - 2)}┘`));
					return lines;
				},

				invalidate(): void {
					mdTheme = getMarkdownTheme();
					md = new Markdown(plan, 0, 0, mdTheme);
					cachedMdLines = [];
				},

				handleInput(data: string): void {
					if (state === "loading") return;

					// ── Global keys ──
					if (matchesKey(data, Key.escape)) {
						// Esc from annotation panel: cancel annotation, return to plan
						if (focus === "annotate") {
							annotationText = "";
							annotationCursor = 0;
							focus = "plan";
							requestRender();
							return;
						}
						// Esc from plan panel: cancel entirely if no annotations, accept otherwise
						if (annotations.length === 0) {
							done(null);
						} else {
							done({ accepted: true });
						}
						return;
					}

					if (matchesKey(data, "ctrl+a") || matchesKey(data, "ctrl+A")) {
						if (annotations.length === 0) {
							// No annotations → accept plan as-is
							done({ accepted: true });
						} else {
							// Submit all annotations for replan
							startReplan();
						}
						return;
					}

					// ── Tab: switch focus ──
					if (matchesKey(data, Key.tab)) {
						focus = focus === "plan" ? "annotate" : "plan";
						annotationCursor = annotationText.length;
						requestRender();
						return;
					}

					// ── Plan panel keys ──
					if (focus === "plan") {
						const totalLines = cachedMdLines.length;
						const maxVisible = 18;

						if (matchesKey(data, Key.up)) {
							if (cursorLine > 0) {
								cursorLine--;
								if (cursorLine < scrollOffset) scrollOffset = cursorLine;
								requestRender();
							}
							return;
						}
						if (matchesKey(data, Key.down)) {
							if (cursorLine < totalLines - 1) {
								cursorLine++;
								if (cursorLine >= scrollOffset + maxVisible) {
									scrollOffset = cursorLine - maxVisible + 1;
								}
								requestRender();
							}
							return;
						}
						if (matchesKey(data, Key.home)) {
							cursorLine = 0;
							scrollOffset = 0;
							requestRender();
							return;
						}
						if (matchesKey(data, Key.end)) {
							cursorLine = totalLines - 1;
							scrollOffset = Math.max(0, totalLines - maxVisible);
							requestRender();
							return;
						}

						// Enter: start annotating the current line
						if (matchesKey(data, Key.enter)) {
							// Remove existing annotation for this line if present
							annotations = annotations.filter((a) => a.line !== cursorLine);
							focus = "annotate";
							annotationText = "";
							annotationCursor = 0;
							requestRender();
							return;
						}

						// Delete: remove annotation from current line
						if (matchesKey(data, Key.delete) || matchesKey(data, Key.backspace)) {
							const before = annotations.length;
							annotations = annotations.filter((a) => a.line !== cursorLine);
							if (annotations.length < before) requestRender();
							return;
						}

						return;
					}

					// ── Annotation panel keys ──
					if (focus === "annotate") {
						// Enter: save annotation and return to plan
						if (matchesKey(data, Key.enter)) {
							const trimmed = annotationText.trim();
							if (trimmed.length > 0) {
								annotations.push({ line: cursorLine, text: trimmed });
							}
							annotationText = "";
							annotationCursor = 0;
							focus = "plan";
							requestRender();
							return;
						}

						// Text editing
						if (matchesKey(data, Key.backspace)) {
							if (annotationCursor > 0) {
								annotationText =
									annotationText.slice(0, annotationCursor - 1) +
									annotationText.slice(annotationCursor);
								annotationCursor--;
								requestRender();
							}
							return;
						}
						if (matchesKey(data, Key.left)) {
							if (annotationCursor > 0) {
								annotationCursor--;
								requestRender();
							}
							return;
						}
						if (matchesKey(data, Key.right)) {
							if (annotationCursor < annotationText.length) {
								annotationCursor++;
								requestRender();
							}
							return;
						}
						if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
							// In annotate mode, up/down navigate plan cursor instead
							// so user can adjust which line they're annotating
							const totalLines = cachedMdLines.length;
							const maxVisible = 18;
							if (matchesKey(data, Key.up) && cursorLine > 0) {
								cursorLine--;
								if (cursorLine < scrollOffset) scrollOffset = cursorLine;
								requestRender();
							}
							if (matchesKey(data, Key.down) && cursorLine < totalLines - 1) {
								cursorLine++;
								if (cursorLine >= scrollOffset + maxVisible) {
									scrollOffset = cursorLine - maxVisible + 1;
								}
								requestRender();
							}
							return;
						}
						if (data.length === 1 && data.charCodeAt(0) >= 32) {
							annotationText =
								annotationText.slice(0, annotationCursor) +
								data +
								annotationText.slice(annotationCursor);
							annotationCursor++;
							requestRender();
						}
					}
				},
			};
		},
		{
			overlay: true,
			overlayOptions: {
				width: "85%",
				minWidth: 65,
				maxHeight: "85%",
				margin: 1,
			},
		},
	);
}

// ─── Phase 3: Model Selection ─────────────────────────────────────────────────

async function modelSelectionPhase(ctx: any): Promise<string | null> {
	const currentModel = ctx.model;
	const currentLabel = currentModel ? `${currentModel.provider}/${currentModel.id}` : null;

	if (!currentLabel) return null; // Can't select if no current model

	const items: SelectItem[] = [
		{
			value: "__keep__",
			label: `Keep current (${currentLabel})`,
			description: "Use the current model in the new session",
		},
		{
			value: "__other__",
			label: "Specify a different model...",
			description: "Type a model identifier (e.g., anthropic/claude-sonnet-4-5)",
		},
	];

	const result = await ctx.ui.custom<string | null>(
		(tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			container.addChild(
				new Text(theme.fg("accent", theme.bold("Select Model for New Session")), 1, 0),
			);

			const selectList = new SelectList(items, items.length, {
				selectedPrefix: (t: string) => theme.fg("accent", t),
				selectedText: (t: string) => theme.fg("accent", t),
				description: (t: string) => theme.fg("muted", t),
				scrollInfo: (t: string) => theme.fg("dim", t),
				noMatch: (t: string) => theme.fg("warning", t),
			});

			selectList.onSelect = async (item) => {
				if (item.value === "__other__") {
					const modelInput = await ctx.ui.input(
						"Enter model identifier (provider/model-id):",
						"",
					);
					if (modelInput && modelInput.trim()) {
						done(modelInput.trim());
					} else {
						done(null);
					}
				} else {
					done(currentLabel);
				}
			};
			selectList.onCancel = () => done(null);

			container.addChild(selectList);
			container.addChild(
				new Text(
					theme.fg("dim", "↑↓ navigate • enter select • esc keep current"),
					1,
					0,
				),
			);
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

			return {
				render: (w: number) => container.render(w),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		},
		{ overlay: true },
	);

	// null = cancelled → keep current model
	return result ?? currentLabel;
}