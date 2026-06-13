/**
 * ask_user - Interactive tool for asking the user one or more questions.
 *
 * Features:
 * - Up to 10 questions per invocation, each with its own tab
 * - Agent-recommended option (shown with ★ Recommended marker, pre-selected)
 * - Free-form "Write your own..." always available on every question
 * - Optional preview panel: agent can include code diffs, UI mockups, or formatted
 *   text alongside the question to help the user decide. Rendered side-by-side
 *   on wide terminals, stacked below on narrow ones.
 * - Confirmation tab summarizing all answers before final submit
 * - Results flag custom answers so the agent can re-evaluate and ask follow-ups
 * - Multi-select questions (checkbox style): set multi: true, Space toggles options,
 *   Enter adds current and advances; user can pick 1…N options
 * - Vim-style navigation (j/k up/down, h/l tab nav, Enter to select+advance, Space to toggle)
 *
 * Controls: Tab/→/l next tab  |  Shift+Tab/←/h prev tab
 *           ↑/k up  |  ↓/j down  |  Enter select & advance
 *           Space toggle selection (stay on tab)  |  Esc cancel
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

// ── Pastel Palette (matching context-ui.ts) ──────────────────────────────────

const pastel = {
	blue: (s: string) => `\x1b[38;5;153m${s}\x1b[0m`,
	yellow: (s: string) => `\x1b[38;5;228m${s}\x1b[0m`,
	green: (s: string) => `\x1b[38;5;157m${s}\x1b[0m`,
	pink: (s: string) => `\x1b[38;5;182m${s}\x1b[0m`,
	peach: (s: string) => `\x1b[38;5;216m${s}\x1b[0m`,
	lavender: (s: string) => `\x1b[38;5;146m${s}\x1b[0m`,
	cyan: (s: string) => `\x1b[38;5;159m${s}\x1b[0m`,
	gray: (s: string) => `\x1b[38;5;248m${s}\x1b[0m`,
	dimGray: (s: string) => `\x1b[38;5;242m${s}\x1b[0m`,
	selectedBg: (s: string) => `\x1b[48;5;235m${s}\x1b[0m`,
	red: (s: string) => `\x1b[38;5;210m${s}\x1b[0m`,
};

/** Minimum terminal width to enable side-by-side preview layout */
const SPLIT_MIN_WIDTH = 85;
/** Fraction of total width given to the preview panel (right side) */
const PREVIEW_FRACTION = 0.38;

// ── Experimental: Preview Panel ──────────────────────────────────────────────
//
// Set to true to enable the side-by-side / stacked preview panel.
// MARKED EXPERIMENTAL — known rendering issues with narrow terminals.
//
const ENABLE_PREVIEW = false;

// ── Types ────────────────────────────────────────────────────────────────────

interface AskOption {
	value: string;
	label: string;
	description?: string;
	recommended?: boolean;
}

interface RenderOption extends AskOption {
	isOther?: boolean;
}

interface AskPreview {
	type?: "code" | "diff" | "ui" | "text";
	caption?: string;
	content: string;
}

interface AskQuestion {
	id: string;
	label: string;
	header: string;
	options: AskOption[];
	allowOther: boolean;
	recommendedIndex: number;
	multi: boolean;
	preview?: AskPreview;
}

interface AskAnswer {
	questionId: string;
	value: string;
	label: string;
	isCustom: boolean;
	optionIndex?: number;
	wasRecommended?: boolean;
}

interface AskResult {
	questions: AskQuestion[];
	answers: AskAnswer[];
	cancelled: boolean;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label for the option" }),
	description: Type.Optional(Type.String({ description: "Optional description shown below the label" })),
	recommended: Type.Optional(
		Type.Boolean({ description: "Set to true for the option the agent recommends (only one per question)" }),
	),
});

const PreviewSchema = Type.Object({
	type: Type.Optional(
		Type.String({ description: "Hint for rendering: 'code', 'diff', 'ui', or 'text'" }),
	),
	caption: Type.Optional(Type.String({ description: "Short caption at the top of the preview box" })),
	content: Type.String({ description: "Preview text — code, diff output, ASCII layout, etc." }),
});

const QuestionSchema = Type.Object({
	id: Type.String({ description: "Unique identifier for this question, e.g. 'scope' or 'priority'" }),
	label: Type.Optional(
		Type.String({ description: "Short label for the tab bar, e.g. 'Scope'. Defaults to Q1, Q2, ..." }),
	),
	header: Type.String({ description: "The full question text shown to the user" }),
	options: Type.Array(OptionSchema, { description: "Available options to choose from" }),
	allow_other: Type.Optional(
		Type.Boolean({
			description: "Allow the user to type their own answer instead of picking an option (default: true)",
		}),
	),
	multi: Type.Optional(
		Type.Boolean({ description: "Allow selecting multiple options, checkbox style (default: false)" }),
	),
	preview: Type.Optional(PreviewSchema),
});

const AskUserParams = Type.Object({
	questions: Type.Array(QuestionSchema, {
		description: "Questions to ask (up to 10)",
	}),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function errorResult(message: string, questions: AskQuestion[] = []): {
	content: Array<{ type: "text"; text: string }>;
	details: AskResult;
} {
	return {
		content: [{ type: "text", text: message }],
		details: { questions, answers: [], cancelled: true },
	};
}

function findRecommendedIndex(options: AskOption[]): number {
	return options.findIndex((o) => o.recommended === true);
}

/** Join two arrays of lines side-by-side with a gutter between them. */
function zipSideBySide(left: string[], right: string[], leftWidth: number, rightWidth: number): string[] {
	const lines: string[] = [];
	const maxLen = Math.max(left.length, right.length);
	for (let i = 0; i < maxLen; i++) {
		const l = padTo(truncateToWidth(left[i] ?? "", leftWidth), leftWidth);
		const r = truncateToWidth(right[i] ?? "", rightWidth);
		lines.push(truncateToWidth(`${l}  ${r}`, leftWidth + 2 + rightWidth));
	}
	return lines;
}

/** Compute the display width of a string ignoring ANSI escape codes. */
function visibleLen(s: string): number {
	return s.replace(/\x1b\[[^m]*m/g, "").length;
}

/** Pad a string to a target display width, handling ANSI codes. */
function padTo(s: string, target: number): string {
	const current = visibleLen(s);
	if (current >= target) return truncateToWidth(s, target);
	return s + " ".repeat(target - current);
}

// ── The Renderer ─────────────────────────────────────────────────────────────

class AskUserRenderer {
	currentTab = 0;
	optionIndex = 0;
	inputMode = false;
	inputQuestionId: string | null = null;
	answers = new Map<string, AskAnswer[]>();
	cachedLines: string[] | undefined;

	editor: Editor;

	constructor(
		private tui: { requestRender(): void },
		private questions: AskQuestion[],
		private done: (result: AskResult) => void,
	) {
		const editorTheme: EditorTheme = {
			borderColor: (s: string) => pastel.blue(s),
			selectList: {
				selectedPrefix: (t: string) => pastel.yellow(t),
				selectedText: (t: string) => pastel.yellow(t),
				description: (t: string) => pastel.gray(t),
				scrollInfo: (t: string) => pastel.dimGray(t),
				noMatch: (t: string) => pastel.peach(t),
			},
		};
		this.editor = new Editor(this.tui, editorTheme);

		const q = this.currentQuestion();
		if (q && q.recommendedIndex >= 0) {
			this.optionIndex = q.recommendedIndex;
		}

		this.editor.onSubmit = (value: string) => {
			if (!this.inputQuestionId) return;
			const trimmed = value.trim() || "(no response)";
			this.saveAnswer(this.inputQuestionId, trimmed, trimmed, true);
			this.exitInputMode();
			this.advanceAfterAnswer();
		};
	}

	private get isMulti(): boolean {
		return this.questions.length > 1;
	}

	private get totalTabs(): number {
		return this.questions.length + 1;
	}

	private get submitTabIndex(): number {
		return this.questions.length;
	}

	currentQuestion(): AskQuestion | undefined {
		return this.questions[this.currentTab];
	}

	currentOptions(): RenderOption[] {
		const q = this.currentQuestion();
		if (!q) return [];
		const opts: RenderOption[] = [...q.options];
		if (q.allowOther) {
			opts.push({ value: "__other__", label: "Write your own...", isOther: true });
		}
		return opts;
	}

	allAnswered(): boolean {
		return this.questions.every((q) => {
			const answers = this.answers.get(q.id);
			return answers !== undefined && answers.length > 0;
		});
	}

	private answersArray(): AskAnswer[] {
		return Array.from(this.answers.values()).flat();
	}

	private saveAnswer(questionId: string, value: string, label: string, isCustom: boolean) {
		const matchingOption = isCustom ? undefined : this.currentOptions()[this.optionIndex];
		const optIndex = isCustom ? undefined : this.optionIndex + 1;
		const wasRecommended = !isCustom && matchingOption?.recommended === true;

		const answer: AskAnswer = {
			questionId,
			value,
			label,
			isCustom,
			optionIndex: optIndex,
			wasRecommended,
		};

		const q = this.questions.find((q) => q.id === questionId);
		if (q?.multi) {
			const existing = this.answers.get(questionId) || [];
			if (!existing.some((a) => a.optionIndex === optIndex && !a.isCustom)) {
				existing.push(answer);
				this.answers.set(questionId, existing);
			}
		} else {
			this.answers.set(questionId, [answer]);
		}
	}

	private removeAnswer(questionId: string, optionIndex?: number) {
		const q = this.questions.find((q) => q.id === questionId);
		if (q?.multi && optionIndex !== undefined) {
			const existing = this.answers.get(questionId) || [];
			const filtered = existing.filter((a) => a.optionIndex !== optionIndex);
			if (filtered.length === 0) {
				this.answers.delete(questionId);
			} else {
				this.answers.set(questionId, filtered);
			}
		} else {
			this.answers.delete(questionId);
		}
	}

	private currentAnsweredOptionIndex(): number {
		const q = this.currentQuestion();
		if (!q) return -1;
		if (q.multi) return -1;
		const answers = this.answers.get(q.id);
		if (!answers || answers.length === 0) return -1;
		const a = answers[0];
		if (a.isCustom) return -1;
		return (a.optionIndex ?? 0) - 1;
	}

	private exitInputMode() {
		this.inputMode = false;
		this.inputQuestionId = null;
		this.editor.setText("");
	}

	private advanceAfterAnswer() {
		if (!this.isMulti) {
			this.done({ questions: this.questions, answers: this.answersArray(), cancelled: false });
			return;
		}
		for (let i = this.currentTab + 1; i < this.questions.length; i++) {
			const a = this.answers.get(this.questions[i].id);
			if (!a || a.length === 0) {
				this.currentTab = i;
				this.optionIndex = this.questions[i].recommendedIndex >= 0 ? this.questions[i].recommendedIndex : 0;
				this.refresh();
				return;
			}
		}
		this.currentTab = this.submitTabIndex;
		this.refresh();
	}

	private refresh() {
		this.cachedLines = undefined;
		this.tui.requestRender();
	}

	private setOptionIndexForTab() {
		const q = this.currentQuestion();
		if (q && q.recommendedIndex >= 0) {
			this.optionIndex = q.recommendedIndex;
		} else {
			this.optionIndex = 0;
		}
	}

	// ── Input handling ─────────────────────────────────────────────────────

	handleInput(data: string) {
		if (this.inputMode) {
			if (matchesKey(data, Key.escape)) {
				this.exitInputMode();
				this.refresh();
				return;
			}
			this.editor.handleInput(data);
			this.refresh();
			return;
		}

		// ── Tab navigation (vim h/l + arrows + Tab/Shift+Tab) ──
		if (this.isMulti) {
			const navNext = matchesKey(data, Key.tab) || matchesKey(data, Key.right) || data === "l";
			const navPrev = matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left) || data === "h";

			if (navNext) {
				this.currentTab = (this.currentTab + 1) % this.totalTabs;
				this.setOptionIndexForTab();
				this.refresh();
				return;
			}
			if (navPrev) {
				this.currentTab = (this.currentTab - 1 + this.totalTabs) % this.totalTabs;
				this.setOptionIndexForTab();
				this.refresh();
				return;
			}
		}

		// ── Submit tab ──
		if (this.currentTab === this.submitTabIndex) {
			if (matchesKey(data, Key.enter) && this.allAnswered()) {
				this.done({ questions: this.questions, answers: this.answersArray(), cancelled: false });
				return;
			}
			if (matchesKey(data, Key.escape)) {
				this.done({ questions: this.questions, answers: this.answersArray(), cancelled: true });
				return;
			}
			if (matchesKey(data, Key.tab) || data === "h") {
				this.currentTab = 0;
				this.setOptionIndexForTab();
				this.refresh();
			}
			return;
		}

		const opts = this.currentOptions();
		const q = this.currentQuestion();
		if (!q) return;

		// ── Option navigation (vim j/k + arrows) ──
		if (matchesKey(data, Key.up) || data === "k") {
			this.optionIndex = Math.max(0, this.optionIndex - 1);
			this.refresh();
			return;
		}
		if (matchesKey(data, Key.down) || data === "j") {
			this.optionIndex = Math.min(opts.length - 1, this.optionIndex + 1);
			this.refresh();
			return;
		}

		// ── Spacebar: toggle selection ──
		if (matchesKey(data, Key.space)) {
			const opt = opts[this.optionIndex];
			if (opt.isOther) {
				this.inputMode = true;
				this.inputQuestionId = q.id;
				this.editor.setText("");
				this.refresh();
				return;
			}
			if (q.multi) {
				const currentSelections = this.answers.get(q.id) || [];
				const optIdx = this.optionIndex + 1;
				if (currentSelections.some((a) => a.optionIndex === optIdx)) {
					this.removeAnswer(q.id, optIdx);
				} else {
					this.saveAnswer(q.id, opt.value, opt.label, false);
				}
			} else {
				const currentAnswerIdx = this.currentAnsweredOptionIndex();
				if (currentAnswerIdx === this.optionIndex) {
					this.removeAnswer(q.id);
				} else {
					this.saveAnswer(q.id, opt.value, opt.label, false);
				}
			}
			this.refresh();
			return;
		}

		// ── Enter: select and advance ──
		if (matchesKey(data, Key.enter)) {
			const opt = opts[this.optionIndex];
			if (opt.isOther) {
				this.inputMode = true;
				this.inputQuestionId = q.id;
				this.editor.setText("");
				this.refresh();
				return;
			}
			if (q.multi) {
				const currentSelections = this.answers.get(q.id) || [];
				const optIdx = this.optionIndex + 1;
				if (!currentSelections.some((a) => a.optionIndex === optIdx)) {
					this.saveAnswer(q.id, opt.value, opt.label, false);
				}
				const after = this.answers.get(q.id) || [];
				if (after.length === 0) {
					this.saveAnswer(q.id, opt.value, opt.label, false);
				}
			} else {
				this.saveAnswer(q.id, opt.value, opt.label, false);
			}
			this.advanceAfterAnswer();
			return;
		}

		if (matchesKey(data, Key.escape)) {
			this.done({ questions: this.questions, answers: this.answersArray(), cancelled: true });
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	//  Rendering
	// ═══════════════════════════════════════════════════════════════════════════

	render(width: number): string[] {
		if (this.cachedLines) return this.cachedLines;

		const lines: string[] = [];
		const add = (s: string) => lines.push(truncateToWidth(s, width));

		// ── Top border ──
		add(pastel.lavender("─".repeat(width)));

		// ── Tab bar ──
		if (this.isMulti) {
			const tabs: string[] = [];
			for (let i = 0; i < this.questions.length; i++) {
				const q = this.questions[i];
				const isActive = i === this.currentTab;
				const answersForQ = this.answers.get(q.id);
				const isAnswered = answersForQ !== undefined && answersForQ.length > 0;
				const box = isAnswered ? pastel.green("■") : pastel.dimGray("□");
				const text = ` ${box} ${q.label} `;
				const styled = isActive ? pastel.selectedBg(pastel.yellow(text)) : pastel.gray(text);
				tabs.push(styled);
				if (i < this.questions.length - 1) tabs.push(" ");
			}

			const canSubmit = this.allAnswered();
			const isSubmitTab = this.currentTab === this.submitTabIndex;
			const submitText = " ✓ Submit ";
			const submitStyled = isSubmitTab
				? pastel.selectedBg(pastel.yellow(submitText))
				: canSubmit
					? pastel.green(submitText)
					: pastel.dimGray(submitText);
			tabs.push(`  ${submitStyled}`);

			add(` ${tabs.join("")}`);
			lines.push("");
		}

		// ── Content area ──
		if (this.inputMode) {
			this.renderInputMode(add, width);
		} else if (this.currentTab === this.submitTabIndex) {
			this.renderSubmitTab(add, width);
		} else {
			this.renderQuestionTab(add, width);
		}

		// ── Bottom help ──
		lines.push("");
		if (!this.inputMode) {
			const hasPreview = ENABLE_PREVIEW && this.currentQuestion()?.preview != null;
			const splitHint = hasPreview ? "  " : "";
			const help = this.isMulti
				? `${pastel.dimGray(" Tab/→/l next  •  Shift+Tab/←/h prev  •  ↑/k ↓/j  •  Enter sel+adv  •  Space toggle  •  Esc cancel")}${splitHint}`
				: `${pastel.dimGray(" ↑/k ↓/j  •  Enter select  •  Space toggle  •  Esc cancel")}`;
			add(help);
		}
		add(pastel.lavender("─".repeat(width)));

		this.cachedLines = lines;
		return lines;
	}

	// ── Input mode ─────────────────────────────────────────────────────────

	private renderInputMode(add: (s: string) => void, width: number) {
		const q = this.currentQuestion();
		if (!q) return;

		add(pastel.blue(` ${q.header}`));
		add("");
		this.renderOptionsLines(add);
		add("");
		add(pastel.gray(" Your answer:"));
		for (const line of this.editor.render(width - 2)) {
			add(` ${line}`);
		}
		add("");
		add(pastel.dimGray(" Enter to submit • Esc to go back"));
	}

	// ── Submit tab ─────────────────────────────────────────────────────────

	private renderSubmitTab(add: (s: string) => void, _width: number) {
		add(pastel.yellow(" ◆◆  " + pastel.cyan("Review & Submit") + "  ◆◆"));
		add("");

		for (const q of this.questions) {
			const answers = this.answers.get(q.id);
			if (answers && answers.length > 0) {
				const qLabel = pastel.dimGray(`${q.label}:`);
				const parts: string[] = [];
				for (const a of answers) {
					if (a.isCustom) {
						parts.push(`${pastel.pink("(wrote)")} ${pastel.blue(a.label)}`);
					} else if (a.wasRecommended) {
						parts.push(`${pastel.green(a.label)} ${pastel.pink("★")}`);
					} else {
						parts.push(pastel.lavender(`[${a.optionIndex}] ${a.label}`));
					}
				}
				add(`   ${qLabel} ${parts.join(pastel.dimGray(", "))}`);
			} else {
				add(`   ${pastel.dimGray(q.label)}: ${pastel.peach("(unanswered)")}`);
			}
		}

		add("");
		if (this.allAnswered()) {
			add(pastel.green(" Press Enter to submit"));
		} else {
			const missing = this.questions
				.filter((q) => {
					const a = this.answers.get(q.id);
					return !a || a.length === 0;
				})
				.map((q) => q.label)
				.join(", ");
			add(pastel.peach(` Unanswered: ${missing}  —  Tab/h to go back`));
		}
	}

	// ── Question tab (split or full-width) ─────────────────────────────────

	private renderQuestionTab(add: (s: string) => void, width: number) {
		const q = this.currentQuestion();
		if (!q) return;

		const preview = ENABLE_PREVIEW ? q.preview : undefined;
		const useSplit = preview != null && width >= SPLIT_MIN_WIDTH;

		if (useSplit) {
			const previewWidth = Math.max(30, Math.floor(width * PREVIEW_FRACTION));
			const leftWidth = width - previewWidth - 2;

			// Collect left and right panels
			const leftLines: string[] = [];
			const la = (s: string) => leftLines.push(truncateToWidth(s, leftWidth));
			la(pastel.blue(` ${q.header}`));
			la("");
			this.renderOptionsInto(la);

			const rightLines = this.renderPreviewBox(preview!, previewWidth);

			// Zip side-by-side, then add to main lines
			const zipped = zipSideBySide(leftLines, rightLines, leftWidth, previewWidth);
			for (const line of zipped) add(line);
		} else {
			add(pastel.blue(` ${q.header}`));
			add("");
			this.renderOptionsLines(add);

			// Stack preview below options on narrow terminals
			if (preview) {
				add("");
				const previewLines = this.renderPreviewBox(preview, width);
				for (const line of previewLines) add(line);
			}
		}
	}

	// ── Options list (callback-based, for full-width) ─────────────────────

	private renderOptionsLines(add: (s: string) => void) {
		this.renderOptionsInto(add);
	}

	private renderOptionsInto(add: (s: string) => void) {
		const opts = this.currentOptions();
		const q = this.currentQuestion();
		const answeredIdx = this.currentAnsweredOptionIndex();

		for (let i = 0; i < opts.length; i++) {
			const opt = opts[i];
			const isCursorHere = i === this.optionIndex;
			const isAnswer = q?.multi
				? (this.answers.get(q.id) || []).some((a) => a.optionIndex === i + 1)
				: i === answeredIdx;
			const isOther = opt.isOther === true;

			const cursor = isCursorHere ? pastel.cyan("▸") : " ";
			const check = isAnswer ? pastel.green("●") : pastel.dimGray("○");

			let line: string;

			if (isOther && this.inputMode) {
				line = ` ${cursor} ${check} ${pastel.blue(`${opt.label} ✎`)}`;
			} else if (isCursorHere) {
				line = ` ${cursor} ${check} ${pastel.yellow(opt.label)}`;
			} else if (isAnswer) {
				line = `   ${check} ${pastel.green(opt.label)}`;
			} else {
				line = `   ${check} ${opt.label}`;
			}

			if (opt.recommended && !opt.isOther) {
				if (isCursorHere) {
					line += `  ${pastel.selectedBg(pastel.pink(" ★ Recommended "))}`;
				} else if (isAnswer) {
					line += `  ${pastel.pink(" ★")}`;
				} else {
					line += `  ${pastel.pink("★")}`;
				}
			}

			add(line);

			if (opt.description) {
				const des = isCursorHere ? pastel.gray(opt.description) : pastel.dimGray(opt.description);
				add(`       ${des}`);
			}
		}
	}

	// ── Preview box (EXPERIMENTAL) ────────────────────────────────────────

	private renderPreviewBox(preview: AskPreview, boxWidth: number): string[] {
		const lines: string[] = [];
		const innerW = boxWidth - 2; // space inside the border

		// Top border with caption
		const caption = preview.caption ?? preview.type ?? "Preview";
		const capText = ` ${caption} `;
		// Use a longer dash for the rest
		const dash = "─";
		let topBorder: string;
		if (visibleLen(capText) + 4 <= boxWidth) {
			const leftDash = Math.max(0, Math.floor((boxWidth - visibleLen(capText) - 2) / 2));
			const rightDash = Math.max(0, boxWidth - leftDash - visibleLen(capText) - 2);
			topBorder = pastel.lavender("┌" + dash.repeat(leftDash)) + pastel.cyan(capText) + pastel.lavender(dash.repeat(rightDash) + "┐");
		} else {
			topBorder = pastel.lavender("┌" + dash.repeat(boxWidth - 2) + "┐");
		}
		lines.push(truncateToWidth(topBorder, boxWidth));

		// Content lines
		if (preview.content) {
			const rawLines = preview.content.split("\n");
			for (const raw of rawLines) {
				const styled = this.stylePreviewLine(raw, preview.type ?? "text", innerW);
				lines.push(truncateToWidth(` ${styled}`, boxWidth));
			}
		}

		// Bottom border
		lines.push(truncateToWidth(pastel.lavender("└" + dash.repeat(boxWidth - 2) + "┘"), boxWidth));

		return lines;
	}

	private stylePreviewLine(line: string, type: string, maxW: number): string {
		const trimmed = line.length > maxW ? line.slice(0, maxW - 1) + "…" : line;
		const padded = trimmed + " ".repeat(Math.max(0, maxW - visibleLen(trimmed)));

		if (type === "diff") {
			if (trimmed.startsWith("+") && !trimmed.startsWith("+++")) {
				return pastel.green(padded);
			}
			if (trimmed.startsWith("-") && !trimmed.startsWith("---")) {
				return pastel.red(padded);
			}
			if (trimmed.startsWith("@@")) {
				return pastel.cyan(padded);
			}
			return pastel.dimGray(padded);
		}

		if (type === "code") {
			// Subtle monospace look via dim color
			return pastel.gray(padded);
		}

		// "ui" or "text" — render plain
		return padded;
	}
}

// ── Extension ────────────────────────────────────────────────────────────────

export default function askUser(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_user",
		label: "Ask User",
		description:
			"Ask the user one or more questions. Use when you need user input to make decisions, clarify requirements, or confirm choices. Up to 10 questions per call. Questions support single-select (radio), multi-select (checkbox via multi: true), and free-form input. Each question can include an optional preview panel in a side-by-side layout — useful for showing code diffs, UI mockups, or formatted text alongside the question.",
		promptSnippet: "Ask the user questions with single/multi select, recommendations, previews, and free-form input",
		promptGuidelines: [
			"Use ask_user when you need user input to make a decision or clarify requirements.",
			"Mark one option per question with recommended: true to show your preferred choice.",
			"When answers come back with isCustom: true, the user wrote their own response. Read it carefully — re-evaluate whether it's sufficient or if you need to ask a follow-up question with adjusted options.",
			"Provide between 2-10 options per question. Each option needs a label and can have an optional description.",
			"Use clear, specific question headers. The label field is for the short tab label (keep it to 1-2 words).",
			'Include a preview when a visual helps the user decide: code diffs (type: "diff"), code snippets (type: "code"), ASCII UI layouts (type: "ui"), or formatted text (type: "text"). Previews are optional — omit when not useful.',
			"Set multi: true on a question to let the user select multiple options (checkbox style). When answers come back, filter by questionId to see all selected options.",
		],
		parameters: AskUserParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (ctx.mode !== "tui") {
				return errorResult("Error: ask_user requires interactive mode (TUI not available)");
			}

			const rawQuestions = params.questions as Array<{
				id: string;
				label?: string;
				header: string;
				options: AskOption[];
				allow_other?: boolean;
				multi?: boolean;
				preview?: AskPreview;
			}>;

			if (rawQuestions.length === 0) {
				return errorResult("Error: No questions provided");
			}
			if (rawQuestions.length > 10) {
				return errorResult("Error: Maximum 10 questions per invocation");
			}

			const questions: AskQuestion[] = rawQuestions.map((q, i) => {
				const options: AskOption[] = (q.options || []).map((o) => ({
					value: o.value ?? o.label,
					label: o.label,
					description: o.description,
					recommended: o.recommended === true,
				}));
				return {
					id: q.id,
					label: q.label || `Q${i + 1}`,
					header: q.header,
					options,
					allowOther: q.allow_other !== false,
					recommendedIndex: findRecommendedIndex(options),
					multi: q.multi === true,
					preview: q.preview,
				};
			});

			for (const q of questions) {
				if (q.options.length === 0) {
					return errorResult(`Error: Question "${q.label}" has no options`, questions);
				}
			}

			const result = await ctx.ui.custom<AskResult>((tui, theme, _kb, done) => {
				const renderer = new AskUserRenderer(tui, questions, done);
				return {
					render: (w: number) => renderer.render(w),
					invalidate: () => {
						renderer.cachedLines = undefined;
					},
					handleInput: (data: string) => renderer.handleInput(data),
				};
			});

			if (result.cancelled) {
				return {
					content: [{ type: "text", text: "User cancelled the questions" }],
					details: result,
				};
			}

			const lines: string[] = ["User answers:"];
			for (const q of questions) {
				const answers = result.answers.filter((a) => a.questionId === q.id);
				if (answers.length === 0) {
					lines.push(`  ${q.label}: (skipped)`);
					continue;
				}
				for (const a of answers) {
					if (a.isCustom) {
						lines.push(`  ${q.label}: [CUSTOM] user wrote: "${a.label}"`);
						lines.push(
							`    ⚠ isCustom: true — evaluate this response and consider follow-up questions if ambiguous`,
						);
					} else {
						const rec = a.wasRecommended ? " ✓ matched recommendation" : "";
						lines.push(`  ${q.label}: [${a.optionIndex}] ${a.label}${rec}`);
					}
				}
			}

			return {
				content: [{ type: "text", text: lines.join("\n") }],
				details: result,
			};
		},

		renderCall(args, theme, _context) {
			const qs = (args.questions as Array<{ label?: string; id: string; preview?: unknown }>) || [];
			const count = qs.length;
			const hasPreview = ENABLE_PREVIEW && qs.some((q) => q.preview);
			const labels = qs.map((q) => q.label || q.id).join(", ");
			let text = theme.fg("toolTitle", theme.bold("ask_user "));
			text += theme.fg("muted", `${count} question${count !== 1 ? "s" : ""}`);
			if (hasPreview) text += theme.fg("dim", " +preview");
			if (labels) {
				text += theme.fg("dim", ` (${truncateToWidth(labels, 40)})`);
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as AskResult | undefined;
			if (!details || details.cancelled) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}

			const answerLines: string[] = [];
			for (const q of details.questions) {
				const answers = details.answers.filter((a) => a.questionId === q.id);
				if (answers.length === 0) continue;

				const parts: string[] = [];
				let hasCustom = false;
				let hasRecommended = false;
				for (const a of answers) {
					if (a.isCustom) {
						hasCustom = true;
						parts.push(theme.fg("accent", a.label));
					} else if (a.wasRecommended) {
						hasRecommended = true;
						parts.push(theme.fg("success", a.label));
					} else {
						const idx = a.optionIndex ? `${a.optionIndex}. ` : "";
						parts.push(`${idx}${theme.fg("text", a.label)}`);
					}
				}
				const sep = theme.fg("dim", ", ");
				const suffix = hasCustom ? theme.fg("accent", " ✎") : "";
				const prefix = hasRecommended ? theme.fg("success", "★ ") : theme.fg("success", "✓ ");
				answerLines.push(
					`${prefix}${theme.fg("muted", q.label)}: ${parts.join(sep)}${suffix}`,
				);
			}

			return new Text(answerLines.join("\n"), 0, 0);
		},
	});
}
