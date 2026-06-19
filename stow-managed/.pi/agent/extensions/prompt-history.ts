import { withHookLogging } from "./lib/hook-logger";
import { type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HISTORY_FILE = join(homedir(), ".pi", "agent", "prompt-history.jsonl");
const MAX_ITEMS = 100_000;
const VISIBLE_ROWS = 15;

// ── Colours ───────────────────────────────────────────────────────────────────

const c = {
	blue:     (s: string) => `\x1b[38;5;153m${s}\x1b[0m`,
	yellow:   (s: string) => `\x1b[38;5;228m${s}\x1b[0m`,
	cyan:     (s: string) => `\x1b[38;5;159m${s}\x1b[0m`,
	lavender: (s: string) => `\x1b[38;5;146m${s}\x1b[0m`,
	peach:    (s: string) => `\x1b[38;5;216m${s}\x1b[0m`,
	dimGray:  (s: string) => `\x1b[38;5;242m${s}\x1b[0m`,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
	text: string;
	ts: number;
	cwd: string;
}

interface DisplayItem {
	value: string;
	label: string;
	detail: string;
	dateStr: string;    // relative time for display column, e.g. "3d ago"
	searchDate: string; // ISO date "YYYY-MM-DD" for date-based filtering
}

// ── File helpers ──────────────────────────────────────────────────────────────

function appendEntry(text: string, cwd: string): void {
	const trimmed = text.trim();
	if (trimmed.length < 3) return;
	try {
		appendFileSync(HISTORY_FILE, JSON.stringify({ text: trimmed, ts: Date.now(), cwd }) + "\n");
	} catch {
		// ignore write failures
	}
}

function loadHistory(): HistoryEntry[] {
	if (!existsSync(HISTORY_FILE)) return [];
	try {
		return readFileSync(HISTORY_FILE, "utf-8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as HistoryEntry);
	} catch {
		return [];
	}
}

function relativeDate(ts: number): string {
	const days = Math.floor((Date.now() - ts) / 86_400_000);
	if (days === 0) return "today";
	if (days === 1) return "yest.";
	if (days < 7) return `${days}d ago`;
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks}w ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(days / 365)}y ago`;
}

function deduplicateHistory(entries: HistoryEntry[]): HistoryEntry[] {
	const seen = new Set<string>();
	return [...entries]
		.reverse()
		.filter((e) => {
			if (seen.has(e.text)) return false;
			seen.add(e.text);
			return true;
		})
		.slice(0, MAX_ITEMS);
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function promptHistory(pi: ExtensionAPI) {
	pi.on("input", withHookLogging("prompt-history", "input", async (event, ctx) => {
		if ((event.source === "interactive" || event.source === "extension") && event.text) {
			appendEntry(event.text, ctx.cwd);
		}
	}));

	pi.registerShortcut("ctrl+r", {
		description: "Search prompt history",
		handler: async (ctx) => {
			if (ctx.mode !== "tui") return;

			const entries = deduplicateHistory(loadHistory());
			if (entries.length === 0) {
				ctx.ui.notify("No prompt history yet", "info");
				return;
			}

			const allItems: DisplayItem[] = entries.map((e) => ({
				value: e.text,
				label: e.text.replace(/\n+/g, " ↵ ").slice(0, 200),
				detail: `${new Date(e.ts).toLocaleDateString()}  ${e.cwd}`,
				dateStr: relativeDate(e.ts),
				searchDate: new Date(e.ts).toISOString().slice(0, 10),
			}));

			const selected = await ctx.ui.custom<string | null>((tui, _theme, _kb, done) => {
				let query = "";
				let filtered: DisplayItem[] = [...allItems];
				let cursor = 0;
				let cachedLines: string[] | undefined;

				function applyFilter(): void {
					if (!query) {
						filtered = [...allItems];
					} else {
						const q = query.toLowerCase();
						filtered = allItems.filter((item) =>
							item.label.toLowerCase().includes(q) ||
							item.searchDate.includes(q) ||
							item.dateStr.toLowerCase().includes(q)
						);
					}
					cursor = 0;
					cachedLines = undefined;
				}

				function refresh(): void {
					cachedLines = undefined;
					tui.requestRender();
				}

				function handleInput(data: string): void {
					if (matchesKey(data, Key.escape)) {
						done(null);
						return;
					}

					if (matchesKey(data, Key.enter)) {
						if (filtered[cursor]) done(filtered[cursor].value);
						return;
					}

					// j/k and arrow keys navigate the list
					if (matchesKey(data, Key.up) || data === "k") {
						cursor = Math.max(0, cursor - 1);
						refresh();
						return;
					}
					if (matchesKey(data, Key.down) || data === "j") {
						cursor = Math.min(Math.max(0, filtered.length - 1), cursor + 1);
						refresh();
						return;
					}

					// backspace removes from query
					if (matchesKey(data, Key.backspace)) {
						query = query.slice(0, -1);
						applyFilter();
						refresh();
						return;
					}

					// ctrl+u clears query
					if (data === "\x15") {
						query = "";
						applyFilter();
						refresh();
						return;
					}

					// any other printable char appends to query
					if (data.length === 1 && data >= " ") {
						query += data;
						applyFilter();
						refresh();
					}
				}

				function render(width: number): string[] {
					if (cachedLines) return cachedLines;

					const lines: string[] = [];
					const add = (s: string) => lines.push(truncateToWidth(s, width));

					add(c.lavender("─".repeat(width)));
					add(c.blue(` Prompt History `) + c.dimGray(`(${allItems.length} / ${MAX_ITEMS.toLocaleString()} entries)`));

					// Search bar
					const qDisplay = query
						? c.yellow(query) + c.dimGray("▌")
						: c.dimGray("type to filter…");
					add(` ${c.dimGray("/")} ${qDisplay}`);
					add("");

					if (filtered.length === 0) {
						add(c.peach("  No matches"));
					} else {
						// Keep cursor visible within the scrolling window
						const half = Math.floor(VISIBLE_ROWS / 2);
						const start = Math.max(0, Math.min(cursor - half, filtered.length - VISIBLE_ROWS));
						const end = Math.min(filtered.length, start + VISIBLE_ROWS);

						const DATE_COL = 8; // chars reserved for date column
						for (let i = start; i < end; i++) {
							const item = filtered[i];
							const isSel = i === cursor;
							const arrow = isSel ? c.cyan("▸") : " ";
							const dateCol = item.dateStr.padEnd(DATE_COL);
							const label = truncateToWidth(item.label, width - 4 - DATE_COL);
							const styledDate = isSel ? c.peach(dateCol) : c.dimGray(dateCol);
							const styledLabel = isSel ? c.yellow(label) : label;
							add(` ${arrow} ${styledDate} ${styledLabel}`);
						}

						if (filtered.length > VISIBLE_ROWS) {
							add(c.dimGray(`  ${cursor + 1} / ${filtered.length}`));
						}

						// Date + cwd for the selected entry
						if (filtered[cursor]) {
							add("");
							add(c.dimGray(`  ${filtered[cursor].detail}`));
						}
					}

					add("");
					add(c.dimGray(" j/k ↑↓ navigate  •  letters filter  •  ctrl+u clear  •  enter paste  •  esc cancel"));
					add(c.lavender("─".repeat(width)));

					cachedLines = lines;
					return lines;
				}

				return {
					render,
					invalidate: () => { cachedLines = undefined; },
					handleInput,
				};
			});

			if (selected) {
				ctx.ui.setEditorText(selected);
			}
		},
	});
}
