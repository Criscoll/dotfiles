/**
 * todos — Agent-managed todo list stored as markdown files in .pi/todos/
 *
 * Features:
 * - STORAGE: Each task is a markdown file in .pi/todos/ (e.g. "001-set-up-ci.md")
 *   Shared between user and agent, survives sessions, easy to edit manually
 * - TOOL: `todos` with actions: list, add, detail, claim, unclaim, complete, delete
 *   Callable by the LLM so the agent can manage tasks autonomously
 * - COMMAND: `/todos` shows a live summary UI with status indicators
 * - CLAIMING: Sessions can claim tasks ("in-progress"), marked by session name/ID
 * - STATUS: pending → in-progress → completed lifecycle
 *
 * File format (.pi/todos/XX-name.md):
 *   # Task Title
 *   - Created: 2026-06-16
 *   - Status: pending
 *   - Claimed-by: session-name (only when in-progress)
 *
 *   Description text...
 *
 * Based on Armin Ronacher's /todos extension idea:
 * "The /todos command brings up all items stored in .pi/todos as markdown files.
 *  Both the agent and I can manipulate them, and sessions can claim tasks."
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, Key, truncateToWidth } from "@earendil-works/pi-tui";
import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, basename } from "node:path";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";

// ── Pastel palette ──────────────────────────────────────────────────────────

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

// ── Types ───────────────────────────────────────────────────────────────────

type TodoStatus = "pending" | "in-progress" | "completed";

interface Todo {
	id: string; // filename without .md
	title: string;
	status: TodoStatus;
	claimedBy?: string;
	created: string; // ISO date
	description: string; // everything after the frontmatter
}

// ── File I/O ────────────────────────────────────────────────────────────────

function todosDir(cwd: string): string {
	return join(cwd, ".pi", "todos");
}

function todoPath(dir: string, id: string): string {
	return join(dir, `${id}.md`);
}

function computeNextId(existing: string[], title: string): string {
	// Sort existing IDs numerically and find the next number
	const nums = existing
		.map((id) => {
			const m = id.match(/^(\d+)/);
			return m ? parseInt(m[1], 10) : 0;
		})
		.filter((n) => !isNaN(n))
		.sort((a, b) => a - b);

	const nextNum = nums.length > 0 ? nums[nums.length - 1] + 1 : 1;

	// Create a slug from the title
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);

	return `${String(nextNum).padStart(3, "0")}-${slug}`;
}

function formatTodoFile(todo: Omit<Todo, "id">): string {
	const lines: string[] = [];
	lines.push(`# ${todo.title}`);
	lines.push("");
	lines.push(`- Created: ${todo.created}`);
	lines.push(`- Status: ${todo.status}`);
	if (todo.claimedBy) {
		lines.push(`- Claimed-by: ${todo.claimedBy}`);
	}
	lines.push("");

	if (todo.description) {
		lines.push(todo.description);
	}

	return lines.join("\n") + "\n";
}

function parseTodoFile(content: string, id: string): Todo | null {
	const titleMatch = content.match(/^# (.+)/m);
	if (!titleMatch) return null;

	const title = titleMatch[1].trim();
	const statusMatch = content.match(/^- Status: (.+)/m);
	const status: TodoStatus = statusMatch
		? (statusMatch[1].trim() as TodoStatus)
		: "pending";
	const claimedMatch = content.match(/^- Claimed-by: (.+)/m);
	const claimedBy = claimedMatch ? claimedMatch[1].trim() : undefined;
	const createdMatch = content.match(/^- Created: (.+)/m);
	const created = createdMatch ? createdMatch[1].trim() : new Date().toISOString().slice(0, 10);

	// Description is everything after the metadata block
	const descMatch = content.match(/^-\s+[\w-]+:[^\n]*\n(?:^-\s+[\w-]+:[^\n]*\n)*\n?([\s\S]*)/m);
	const description = descMatch ? descMatch[1].trim() : "";

	return { id, title, status, claimedBy, created, description };
}

async function loadTodos(cwd: string): Promise<Todo[]> {
	const dir = todosDir(cwd);
	if (!existsSync(dir)) return [];

	const files = await readdir(dir);
	const mdFiles = files.filter((f) => f.endsWith(".md")).sort();

	const todos: Todo[] = [];
	for (const file of mdFiles) {
		try {
			const content = await readFile(join(dir, file), "utf-8");
			const id = file.replace(/\.md$/, "");
			const todo = parseTodoFile(content, id);
			if (todo) todos.push(todo);
		} catch {
			// Skip unreadable files
		}
	}

	return todos;
}

async function writeTodo(cwd: string, todo: Todo): Promise<void> {
	const dir = todosDir(cwd);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	const content = formatTodoFile({
		title: todo.title,
		status: todo.status,
		claimedBy: todo.claimedBy,
		created: todo.created,
		description: todo.description,
	});
	await writeFile(todoPath(dir, todo.id), content, "utf-8");
}

async function deleteTodoFile(cwd: string, id: string): Promise<void> {
	const dir = todosDir(cwd);
	const path = todoPath(dir, id);
	if (existsSync(path)) {
		await unlink(path);
	}
}

// ── Tool ────────────────────────────────────────────────────────────────────

const TodoActionSchema = Type.Object({
	action: StringEnum(["list", "add", "detail", "claim", "unclaim", "complete", "delete"] as const),
	title: Type.Optional(Type.String({ description: "Task title (for add)" })),
	id: Type.Optional(Type.String({ description: "Task ID (for detail/claim/unclaim/complete/delete)" })),
	description: Type.Optional(Type.String({ description: "Task description (for add)" })),
});

function todoStatusIcon(status: TodoStatus, claimed?: string): string {
	switch (status) {
		case "pending":
			return c.dimGray("○");
		case "in-progress":
			return c.yellow("◔") + (claimed ? c.dimGray(` ${claimed}`) : "");
		case "completed":
			return c.green("✓");
	}
}

function formatTodoLine(todo: Todo, width: number): string {
	const icon = todoStatusIcon(todo.status, todo.claimedBy);
	const title = todo.status === "completed" ? c.dimGray(todo.title) : c.gray(todo.title);
	const idLabel = c.blue(`#${todo.id}`);
	return `${icon} ${idLabel} ${title}`;
}

export default function todosExtension(pi: ExtensionAPI) {
	// Helper: get a session identifier for claiming
	function getSessionName(ctx: { sessionManager: { getSessionFile: () => string | null } }): string {
		const file = ctx.sessionManager.getSessionFile();
		if (file) return basename(file).replace(/\.jsonl$/, "");
		return `session-${Date.now().toString(36)}`;
	}

	// ── LLM Tool ─────────────────────────────────────────────────────────

	pi.registerTool({
		name: "todos",
		label: "Todos",
		description:
			"Manage task todos stored as markdown files in .pi/todos/. " +
			"Actions: list (show all), add (create with title+description), " +
			"detail (show full task), claim (mark as in-progress with session), " +
			"unclaim (revert to pending), complete, delete.",
		parameters: TodoActionSchema,
		promptSnippet: "List, add, claim, complete, or delete project todo items",
		promptGuidelines: [
			"Use todos to track multi-step work across sessions. " +
			"Claim a task with todos when you start implementing it so the user sees progress.",
		],

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const cwd = ctx.cwd;

			switch (params.action) {
				case "list": {
					const todos = await loadTodos(cwd);
					if (todos.length === 0) {
						return {
							content: [{ type: "text", text: "No todos." }],
							details: { action: "list", todos: [] },
						};
					}
					const pending = todos.filter((t) => t.status === "pending").length;
					const inProgress = todos.filter((t) => t.status === "in-progress").length;
					const completed = todos.filter((t) => t.status === "completed").length;

					const lines = todos.map(
						(t) => `[${t.status === "completed" ? "x" : t.status === "in-progress" ? "~" : " "}] #${t.id}: ${t.title}${t.claimedBy ? ` (${t.claimedBy})` : ""}`,
					);

					return {
						content: [
							{
								type: "text",
								text: `Todos: ${pending} pending, ${inProgress} in-progress, ${completed} completed\n\n${lines.join("\n")}`,
							},
						],
						details: { action: "list", todos: todos.map((t) => ({ id: t.id, title: t.title, status: t.status, claimedBy: t.claimedBy })) },
					};
				}

				case "add": {
					if (!params.title) {
						return {
							content: [{ type: "text", text: "Error: title required for add" }],
							details: { action: "add", error: "title required" },
						};
					}
					const existing = await loadTodos(cwd);
					const existingIds = existing.map((t) => t.id);
					const id = computeNextId(existingIds, params.title);

					const todo: Todo = {
						id,
						title: params.title,
						status: "pending",
						created: new Date().toISOString().slice(0, 10),
						description: params.description ?? "",
					};

					await writeTodo(cwd, todo);

					return {
						content: [{ type: "text", text: `Added todo #${id}: ${params.title}` }],
						details: { action: "add", todo: { id, title: params.title, status: "pending" } },
					};
				}

				case "detail": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required for detail" }],
							details: { action: "detail", error: "id required" },
						};
					}
					const allTodos = await loadTodos(cwd);
					const todo = allTodos.find((t) => t.id === params.id);
					if (!todo) {
						return {
							content: [{ type: "text", text: `Todo #${params.id} not found` }],
							details: { action: "detail", error: `#${params.id} not found` },
						};
					}
					return {
						content: [
							{
								type: "text",
								text: `#${todo.id}: ${todo.title}\nStatus: ${todo.status}${todo.claimedBy ? ` (claimed by ${todo.claimedBy})` : ""}\nCreated: ${todo.created}\n\n${todo.description}`,
							},
						],
						details: { action: "detail", todo: { id: todo.id, title: todo.title, status: todo.status, claimedBy: todo.claimedBy, created: todo.created, description: todo.description } },
					};
				}

				case "claim": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required for claim" }],
							details: { action: "claim", error: "id required" },
						};
					}
					const allT = await loadTodos(cwd);
					const t = allT.find((x) => x.id === params.id);
					if (!t) {
						return {
							content: [{ type: "text", text: `Todo #${params.id} not found` }],
							details: { action: "claim", error: `#${params.id} not found` },
						};
					}
					if (t.status === "completed") {
						return {
							content: [{ type: "text", text: `Todo #${params.id} is already completed` }],
							details: { action: "claim", error: "already completed", todo: t },
						};
					}
					const sessionName = getSessionName(ctx);
					t.status = "in-progress";
					t.claimedBy = sessionName;
					await writeTodo(cwd, t);
					return {
						content: [{ type: "text", text: `Claimed todo #${params.id}: ${t.title} (${sessionName})` }],
						details: { action: "claim", todo: { id: t.id, title: t.title, status: t.status, claimedBy: t.claimedBy } },
					};
				}

				case "unclaim": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required for unclaim" }],
							details: { action: "unclaim", error: "id required" },
						};
					}
					const allU = await loadTodos(cwd);
					const u = allU.find((x) => x.id === params.id);
					if (!u) {
						return {
							content: [{ type: "text", text: `Todo #${params.id} not found` }],
							details: { action: "unclaim", error: `#${params.id} not found` },
						};
					}
					if (u.status !== "in-progress") {
						return {
							content: [{ type: "text", text: `Todo #${params.id} is not claimed` }],
							details: { action: "unclaim", error: "not claimed", todo: u },
						};
					}
					u.status = "pending";
					u.claimedBy = undefined;
					await writeTodo(cwd, u);
					return {
						content: [{ type: "text", text: `Unclaimed todo #${params.id}: ${u.title}` }],
						details: { action: "unclaim", todo: { id: u.id, title: u.title, status: u.status } },
					};
				}

				case "complete": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required for complete" }],
							details: { action: "complete", error: "id required" },
						};
					}
					const allC = await loadTodos(cwd);
					const comp = allC.find((x) => x.id === params.id);
					if (!comp) {
						return {
							content: [{ type: "text", text: `Todo #${params.id} not found` }],
							details: { action: "complete", error: `#${params.id} not found` },
						};
					}
					comp.status = "completed";
					comp.claimedBy = undefined;
					await writeTodo(cwd, comp);
					return {
						content: [{ type: "text", text: `Completed todo #${params.id}: ${comp.title}` }],
						details: { action: "complete", todo: { id: comp.id, title: comp.title, status: comp.status } },
					};
				}

				case "delete": {
					if (!params.id) {
						return {
							content: [{ type: "text", text: "Error: id required for delete" }],
							details: { action: "delete", error: "id required" },
						};
					}
					await deleteTodoFile(cwd, params.id);
					return {
						content: [{ type: "text", text: `Deleted todo #${params.id}` }],
						details: { action: "delete", id: params.id },
					};
				}

				default:
					return {
						content: [{ type: "text", text: `Unknown action: ${params.action}` }],
						details: { action: "list" as const, error: `unknown action: ${params.action}` },
					};
			}
		},

		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("todos ")) + theme.fg("muted", args.action);
			if (args.title) text += ` ${theme.fg("dim", `"${args.title}"`)}`;
			if (args.id) text += ` ${theme.fg("accent", `#${args.id}`)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			const details = result.details as Record<string, unknown> | undefined;
			if (!details) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			const action = details.action as string;

			switch (action) {
				case "list": {
					const todos = details.todos as Array<{ id: string; title: string; status: string; claimedBy?: string }> | undefined;
					if (!todos || todos.length === 0) {
						return new Text(theme.fg("dim", "No todos"), 0, 0);
					}
					const pending = todos.filter((t) => t.status === "pending").length;
					const inProgress = todos.filter((t) => t.status === "in-progress").length;
					const completed = todos.filter((t) => t.status === "completed").length;
					let text = theme.fg("muted", `${todos.length} total (${pending} pending, ${inProgress} in-progress, ${completed} completed)`);
					const display = expanded ? todos : todos.slice(0, 10);
					for (const t of display) {
						const color = t.status === "completed" ? theme.fg("success", "✓") : t.status === "in-progress" ? theme.fg("warning", "◔") : theme.fg("dim", "○");
						const title = t.status === "completed" ? theme.fg("dim", t.title) : theme.fg("muted", t.title);
						const claimed = t.claimedBy ? theme.fg("dim", ` [${t.claimedBy}]`) : "";
						text += `\n${color} ${theme.fg("accent", `#${t.id}`)} ${title}${claimed}`;
					}
					if (!expanded && todos.length > 10) {
						text += `\n${theme.fg("dim", `... ${todos.length - 10} more (expand with Ctrl+O)`)}`;
					}
					return new Text(text, 0, 0);
				}

				case "add": {
					const todo = details.todo as { id: string; title: string } | undefined;
					if (!todo) return new Text(theme.fg("dim", "Added"), 0, 0);
					return new Text(
						theme.fg("success", "✓ Added ") + theme.fg("accent", `#${todo.id}`) + " " + theme.fg("muted", todo.title),
						0, 0,
					);
				}

				case "claim": {
					const todo = details.todo as { id: string; title: string; claimedBy?: string } | undefined;
					if (!todo) return new Text(theme.fg("dim", "Claimed"), 0, 0);
					return new Text(
						theme.fg("warning", "◔ Claimed ") + theme.fg("accent", `#${todo.id}`) + " " + theme.fg("muted", todo.title) + (todo.claimedBy ? theme.fg("dim", ` [${todo.claimedBy}]`) : ""),
						0, 0,
					);
				}

				case "complete": {
					const todo = details.todo as { id: string; title: string } | undefined;
					if (!todo) return new Text(theme.fg("dim", "Completed"), 0, 0);
					return new Text(
						theme.fg("success", "✓ Completed ") + theme.fg("accent", `#${todo.id}`) + " " + theme.fg("dim", todo.title),
						0, 0,
					);
				}

				case "delete": {
					const id = details.id as string;
					return new Text(
						theme.fg("error", "✗ Deleted ") + theme.fg("accent", `#${id}`),
						0, 0,
					);
				}

				default:
					return new Text(theme.fg("dim", String(action)), 0, 0);
			}
		},
	});

	// ── /todos Command ───────────────────────────────────────────────────

	pi.registerCommand("todos", {
		description: "Show all todos on the current branch as a summary",
		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("/todos requires interactive mode", "error");
				return;
			}

			const todos = await loadTodos(ctx.cwd);

			await ctx.ui.custom<void>(
				(_tui, _theme, _kb, done) => {
					let selectedIndex = 0;
					let cachedLines: string[] | undefined;
					let cachedWidth = 0;

					const refresh = () => {
						cachedLines = undefined;
						_tui.requestRender();
					};

					function handleInput(data: string): void {
						if (matchesKey(data, Key.down) || data === "j") {
							if (selectedIndex < todos.length - 1) { selectedIndex++; refresh(); }
							return;
						}
						if (matchesKey(data, Key.up) || data === "k") {
							if (selectedIndex > 0) { selectedIndex--; refresh(); }
							return;
						}
						if (matchesKey(data, Key.escape) || matchesKey(data, "ctrl+c")) {
							done();
						}
					}

					function render(width: number): string[] {
						if (cachedLines && cachedWidth === width) return cachedLines;
						cachedWidth = width;
						const lines: string[] = [];
						const add = (s: string) => lines.push(truncateToWidth(s, width));

						// Top border
						add(c.cyan("┌") + c.cyan("─".repeat(width - 2)) + c.cyan("┐"));

						const pending = todos.filter((t) => t.status === "pending").length;
						const inProgress = todos.filter((t) => t.status === "in-progress").length;
						const completed = todos.filter((t) => t.status === "completed").length;
						const header = c.blue("Todos") + c.dimGray(`  ${todos.length} total (${pending} pending · ${inProgress} in-progress · ${completed} completed)`);
						add(c.cyan("│") + " " + header + " ".repeat(Math.max(0, width - header.length - 4)) + c.cyan("│"));

						// Separator
						add(c.cyan("│") + c.dimGray("─".repeat(width - 2)) + c.cyan("│"));

						if (todos.length === 0) {
							add(c.cyan("│") + " " + c.dimGray("No todos. Ask the agent to add some!") + " ".repeat(Math.max(0, width - 35 - 2)) + c.cyan("│"));
						} else {
							for (let i = 0; i < todos.length; i++) {
								const t = todos[i];
								const isSelected = i === selectedIndex;
								const prefix = isSelected ? c.blue("▸") : " ";

								let icon: string;
								switch (t.status) {
									case "pending":
										icon = c.dimGray("○");
										break;
									case "in-progress":
										icon = c.yellow("◔");
										break;
									case "completed":
										icon = c.green("✓");
										break;
								}

								const idLabel = c.cyan(`#${t.id}`);
								const titleStr = t.status === "completed" ? c.dimGray(t.title) : c.gray(t.title);
								const claimed = t.claimedBy ? c.dimGray(` [${t.claimedBy}]`) : "";

								let todoLine = ` ${prefix} ${icon} ${idLabel} ${titleStr}${claimed}`;
								if (isSelected) {
									todoLine = c.selectedBg(todoLine);
								}
								add(c.cyan("│") + todoLine + " ".repeat(Math.max(0, width - todoLine.length - 4)) + c.cyan("│"));
							}
						}

						// Bottom border + controls
						add(c.cyan("│") + c.dimGray("─".repeat(width - 2)) + c.cyan("│"));
						const controls = c.dimGray(" ↑↓ navigate  ·  Esc close");
						add(c.cyan("│") + " " + controls + " ".repeat(Math.max(0, width - controls.length - 3)) + c.cyan("│"));
						add(c.cyan("└") + c.cyan("─".repeat(width - 2)) + c.cyan("┘"));

						cachedLines = lines;
						return lines;
					}

					return {
						handleInput,
						render,
						invalidate: () => { cachedLines = undefined; cachedWidth = 0; },
					};
				},
			);
		},
	});
}