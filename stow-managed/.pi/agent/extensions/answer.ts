/**
 * answer — Extract inline questions from the last assistant message
 * and present them as a clean input form.
 *
 * Features:
 * - /answer scans the last assistant message for questions (sentences ending with ?)
 * - Presents each question with its own inline-editable answer field
 * - Per-field character-by-character validation: field turns green when non-empty,
 *   stays red/dim when empty; indicator dot (○/●) shows status at a glance
 * - Vim-style navigation: j/k or ↑↓ to select question, Enter to edit, Tab to advance
 * - Escape cancels editing back to navigation, Escape on nav cancels entirely
 * - On submit, sends all Q&A pairs back to the agent as a user message
 *
 * Based on Armin Ronacher's /answer extension idea:
 * "The /answer reads the agent's last response, extracts all the questions,
 *  and reformats them into a nice input box with character-by-character validation."
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

// ── Pastel palette (matching ask-user.ts) ──────────────────────────────────

const c = {
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

// ── Question extraction ────────────────────────────────────────────────────

/**
 * Extract questions from assistant text.
 * Matches lines or segments that end with `?`.
 */
function extractQuestions(text: string): string[] {
	const seen = new Set<string>();
	const questions: string[] = [];

	for (const line of text.split("\n")) {
		// Strip leading bullets, numbers, whitespace
		const trimmed = line.replace(/^[\s\-*\d.]+/, "").trim();
		if (!trimmed.endsWith("?")) continue;
		if (trimmed.length < 3) continue;
		// Deduplicate
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		questions.push(trimmed);
	}

	// Fallback: if nothing found by line, try inline pattern
	if (questions.length === 0) {
		const inlineRe = /[A-Z][^.!?\n]{8,}?\?/g;
		let m: RegExpExecArray | null;
		while ((m = inlineRe.exec(text)) !== null) {
			const q = m[0].trim();
			if (q.length > 3 && !seen.has(q.toLowerCase())) {
				seen.add(q.toLowerCase());
				questions.push(q);
			}
		}
	}

	return questions;
}

// ── UI Component ───────────────────────────────────────────────────────────

interface QuestionAnswer {
	question: string;
	answer: string;
}

/**
 * Validate a single answer character-by-character.
 * Currently checks non-empty; returns true if valid.
 */
function isValidAnswer(text: string): boolean {
	return text.trim().length > 0;
}

/**
 * Build the answer form UI component.
 */
function createAnswerForm(
	questions: string[],
	theme: { fg: (name: string, s: string) => string },
	tui: { requestRender: () => void },
	done: (result: QuestionAnswer[] | null) => void,
): {
	handleInput: (data: string) => void;
	render: (width: number) => string[];
	dispose?: () => void;
	invalidate: () => void;
} {
	let selectedIndex = 0;
	let editMode = false;
	const answers: string[] = questions.map(() => "");
	let cachedLines: string[] | undefined;
	let cachedWidth = 0;

	// Editor instance for editing a single field
	const editTheme: EditorTheme = {
		borderColor: (s) => c.cyan(s),
		selectList: {
			selectedPrefix: (t) => c.blue(t),
			selectedText: (t) => c.blue(t),
			description: (t) => c.gray(t),
			scrollInfo: (t) => c.dimGray(t),
			noMatch: (t) => c.red(t),
		},
	};
	const editor = new Editor(tui, editTheme);

	const refresh = () => {
		cachedLines = undefined;
		tui.requestRender();
	};

	editor.onSubmit = (value: string) => {
		answers[selectedIndex] = value;
		editMode = false;
		editor.setText("");

		// If there's a next question, advance to it
		if (selectedIndex < questions.length - 1) {
			selectedIndex++;
			editor.setText(answers[selectedIndex]);
			editMode = true;
		}
		refresh();
	};

	function handleInput(data: string): void {
		if (editMode) {
			if (matchesKey(data, Key.escape)) {
				// Return to nav mode, keep current value
				editMode = false;
				editor.setText("");
				refresh();
				return;
			}
			if (matchesKey(data, Key.tab)) {
				// Confirm current, move to next
				answers[selectedIndex] = editor.getText();
				editor.setText("");
				if (selectedIndex < questions.length - 1) {
					selectedIndex++;
				}
				editMode = false;
				refresh();
				return;
			}
			editor.handleInput(data);
			refresh();
			return;
		}

		// Navigation mode
		switch (true) {
			case matchesKey(data, Key.enter): {
				// Enter edit mode for selected question
				editMode = true;
				editor.setText(answers[selectedIndex]);
				refresh();
				return;
			}
			case matchesKey(data, Key.down) || data === "j": {
				if (selectedIndex < questions.length - 1) {
					selectedIndex++;
					refresh();
				}
				return;
			}
			case matchesKey(data, Key.up) || data === "k": {
				if (selectedIndex > 0) {
					selectedIndex--;
					refresh();
				}
				return;
			}
			case matchesKey(data, Key.tab): {
				if (selectedIndex < questions.length - 1) {
					selectedIndex++;
					refresh();
				}
				return;
			}
			case matchesKey(data, "shift+tab"): {
				if (selectedIndex > 0) {
					selectedIndex--;
					refresh();
				}
				return;
			}
			case matchesKey(data, Key.escape) || matchesKey(data, "ctrl+c"): {
				done(null);
				return;
			}
			case matchesKey(data, "ctrl+s"): {
				submitAnswers();
				return;
			}
		}
	}

	function submitAnswers(): void {
		const result = questions.map((q, i) => ({
			question: q,
			answer: answers[i].trim(),
		}));
		done(result);
	}

	function render(width: number): string[] {
		if (cachedLines && cachedWidth === width) return cachedLines;
		cachedWidth = width;

		const lines: string[] = [];
		const add = (s: string) => lines.push(truncateToWidth(s, width));

		// Top border
		add(c.cyan("┌") + c.cyan("─".repeat(width - 2)) + c.cyan("┐"));
		add(c.cyan("│") + " " + c.blue("Answer the agent's questions") + " ".repeat(Math.max(0, width - 33 - 2)) + c.cyan("│"));

		const answeredCount = answers.filter((a) => isValidAnswer(a)).length;

		// Separator
		add(c.cyan("│") + c.dimGray("─".repeat(width - 2)) + c.cyan("│"));

		if (questions.length === 0) {
			add(c.cyan("│") + " " + c.gray("No questions found.") + " ".repeat(Math.max(0, width - 18 - 2)) + c.cyan("│"));
		} else {
			for (let i = 0; i < questions.length; i++) {
				const isSelected = i === selectedIndex && !editMode;
				const isEditing = i === selectedIndex && editMode;
				const isValid = isValidAnswer(answers[i]);
				const indicator = isValid ? c.green("●") : c.dimGray("○");

				// Question line
				const qNum = c.gray(`${i + 1}.`);
				const qText = isSelected ? c.cyan(questions[i]) : c.gray(questions[i]);
				const qLine = ` ${qNum} ${qText}`;
				add(c.cyan("│") + qLine + " ".repeat(Math.max(0, width - qLine.length - 4)) + c.cyan("│"));

				// Answer field line
				if (isEditing) {
					// Show editor content
					const editorLines = editor.render(width - 6);
					if (editorLines.length > 0) {
						let editorContent = editorLines[0];
						// Validate in real-time
						const currentText = editor.getText();
						const valid = isValidAnswer(currentText);
						const prefix = valid ? c.green("> ") : c.red("> ");
						const fieldContent = currentText
							? (valid ? c.green(currentText) : c.red(currentText))
							: c.dimGray("Type your answer...");
						const cursor = currentText ? "" : c.cyan("█");
						// Build field with border
						const fieldPrefix = "    " + prefix;
						const fieldLine = fieldContent + (currentText ? " " : cursor);
						const fullField = fieldPrefix + fieldLine;
						add(c.cyan("│") + fullField + " ".repeat(Math.max(0, width - fullField.length - 4)) + c.cyan("│"));
						// Validation hint
						if (currentText && !valid) {
							add(c.cyan("│") + "    " + c.red("✗ Answer cannot be empty") + " ".repeat(Math.max(0, width - 31 - 4)) + c.cyan("│"));
						}
					}
				} else {
					const answerText = answers[i]
						? (isValid ? c.green(answers[i]) : c.red(answers[i]))
						: c.dimGray("(empty)");
					const fieldColor = isSelected ? c.cyan : c.dimGray;
					const fieldLine = `    ${indicator} ${fieldColor("[")} ${answerText} ${fieldColor("]")}`;
					add(c.cyan("│") + fieldLine + " ".repeat(Math.max(0, width - fieldLine.length - 4)) + c.cyan("│"));
				}

				// Small gap between questions
				if (i < questions.length - 1) {
					add(c.cyan("│") + " ".repeat(width - 2) + c.cyan("│"));
				}
			}
		}

		// Bottom border + controls
		add(c.cyan("│") + c.dimGray("─".repeat(width - 2)) + c.cyan("│"));

		let controls: string;
		if (editMode) {
			controls = c.dimGray(" Enter submit  ·  Esc cancel  ·  Tab advance");
		} else {
			controls = c.dimGray(" ↑/↓ navigate  ·  Enter edit  ·  Ctrl+S submit  ·  Esc cancel");
			if (answeredCount > 0) {
				controls += "  " + c.green(`${answeredCount}/${questions.length} answered`);
			}
		}
		add(c.cyan("│") + " " + controls + " ".repeat(Math.max(0, width - controls.length - 3)) + c.cyan("│"));
		add(c.cyan("└") + c.cyan("─".repeat(width - 2)) + c.cyan("┘"));

		cachedLines = lines;
		return lines;
	}

	const onUnmount = () => {
		editor.dispose();
	};

	return {
		handleInput,
		render,
		invalidate: () => { cachedLines = undefined; cachedWidth = 0; },
		dispose: onUnmount,
	};
}

// ── Extension ─────────────────────────────────────────────────────────────

export default function answerExtension(pi: ExtensionAPI) {
	pi.registerCommand("answer", {
		description: "Extract questions from the last assistant message and present a clean input form",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/answer requires interactive mode", "error");
				return;
			}

			// Find the last assistant message on the current branch
			const branch = ctx.sessionManager.getBranch();
			let lastAssistantText: string | undefined;

			for (let i = branch.length - 1; i >= 0; i--) {
				const entry = branch[i];
				if (entry.type === "message") {
					const msg = entry.message;
					if ("role" in msg && msg.role === "assistant") {
						const textParts = (msg.content ?? [])
							.filter((c): c is { type: "text"; text: string } => c.type === "text")
							.map((c) => c.text);
						if (textParts.length > 0) {
							lastAssistantText = textParts.join("\n");
							break;
						}
					}
				}
			}

			if (!lastAssistantText) {
				ctx.ui.notify("No assistant messages found", "error");
				return;
			}

			const questions = extractQuestions(lastAssistantText);

			if (questions.length === 0) {
				ctx.ui.notify("No questions found in the last assistant message", "warning");
				return;
			}

			// Show the answer form
			const result = await ctx.ui.custom<QuestionAnswer[] | null>(
				(tui, _theme, _kb, done) => {
					return createAnswerForm(questions, _theme, tui, done);
				},
			);

			if (!result || result.length === 0) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			// Format results and send to agent
			const answered = result.filter((r) => r.answer.trim().length > 0);
			if (answered.length === 0) {
				ctx.ui.notify("No answers provided", "warning");
				return;
			}

			// Build a structured user message
			const parts = answered.map((r, i) => `Q${i + 1}: ${r.question}\nA${i + 1}: ${r.answer}`);
			const message = `Answers to your questions:\n\n${parts.join("\n\n")}`;

			ctx.ui.notify(`Sent ${answered.length} answer(s) to agent`, "info");

			// Persist the Q&A to a file for context
			const piDir = join(ctx.cwd, ".pi");
			const qaDir = join(piDir, "answers");
			if (!existsSync(qaDir)) {
				await mkdir(qaDir, { recursive: true });
			}
			const timestamp = Date.now();
			const qaFile = join(qaDir, `qa-${timestamp}.md`);
			const qaContent = answered
				.map((r, i) => `## Q${i + 1}: ${r.question}\n\n**Answer:** ${r.answer}\n`)
				.join("\n");
			await writeFile(qaFile, qaContent, "utf-8");

			// Send to agent as a follow-up message
			pi.sendUserMessage(message);
		},
	});
}