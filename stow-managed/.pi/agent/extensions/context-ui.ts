/**
 * Context UI Footer
 *
 * Custom footer with three sections separated by |:
 *   ~/Repos/dotfiles (main) | Sonnet 4.6 $3/$15/M (200k) [████░░░] 40k (20%) | ↑12.3k ↓4.5k Σ$0.042
 *
 * Section 1 (left) — working directory + git branch
 * Section 2 (middle) — model name, per-million pricing rates, context window size, usage bar, token count, percentage
 * Section 3 (right) — input/output tokens, per-prompt cost (Δ), and session total (Σ)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

// Maximum width of the visual progress bar in terminal columns
const MAX_BAR_WIDTH = 10;

function fmtNum(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return `${n}`;
}

function fmtPricing(rate: number): string {
	if (rate === 0) return "$0";
	if (rate >= 1) return `$${rate.toFixed(2)}`;
	if (rate >= 0.01) return `$${rate.toFixed(2)}`;
	return `$${rate.toPrecision(2)}`;
}

export default function (pi: ExtensionAPI) {
	let requestRender: (() => void) | undefined;
	let lastInput = 0;
	let lastOutput = 0;
	let lastCost = 0;

	pi.on("session_start", async (_event, ctx) => {
		lastInput = 0;
		lastOutput = 0;
		lastCost = 0;

		// Reset delta on each user prompt so it shows running cost between prompts
		pi.on("before_agent_start", async () => {
			lastInput = 0;
			lastOutput = 0;
			lastCost = 0;
			requestRender?.();
		});
		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsubBranch,
				invalidate() {},
				render(width: number): string[] {
					const usage = ctx.getContextUsage();
					const contextWindow = ctx.model?.contextWindow ?? 0;
					const currentTokens = usage?.tokens ?? 0;
					const ratio = contextWindow > 0 ? Math.min(1, currentTokens / contextWindow) : 0;
					const pct = Math.round(ratio * 100);

					// Compute token totals and cost from session
					let input = 0;
					let output = 0;
					let cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && (e.message as any).role === "assistant") {
							const m = e.message as any;
							input += m.usage?.input ?? 0;
							output += m.usage?.output ?? 0;
							cost += m.usage?.cost?.total ?? 0;
						}
					}

					const dim = (s: string) => theme.fg("dim", s);
					const pastelBlue = (s: string) => `\x1b[38;5;153m${s}\x1b[0m`;
					const pastelYellow = (s: string) => `\x1b[38;5;228m${s}\x1b[0m`;
					const pastelOrange = (s: string) => `\x1b[38;5;216m${s}\x1b[0m`;
					const pastelGreen = (s: string) => `\x1b[38;5;157m${s}\x1b[0m`;

					// ---- Section 1: directory + branch ----
					const shortCwd = ctx.cwd.replace(process.env.HOME ?? "", "~");
					const branch = footerData.getGitBranch();
					const dirStr = branch ? `${shortCwd} (${branch})` : shortCwd;

					// ---- Section 2: model + pricing + context window + bar + usage ----
					const modelLabel = ctx.model?.name ?? ctx.model?.id ?? "no-model";
					const ctxLabel = fmtNum(contextWindow);
					const tokensLabel = fmtNum(currentTokens);
					const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(4, Math.floor(width / 4)));
					const filled = Math.round(barWidth * ratio);
					const empty = barWidth - filled;

					const barColor =
						pct >= 90
							? (s: string) => theme.fg("error", s)
							: pct >= 70
								? (s: string) => theme.fg("warning", s)
								: (s: string) => theme.fg("text", s);
					const bar = barColor(`${"█".repeat(filled)}${"░".repeat(Math.max(0, empty))}`);

					const pctColored =
						pct >= 90
							? theme.fg("error", `${pct}%`)
							: pct >= 70
								? theme.fg("warning", `${pct}%`)
								: dim(`${pct}%`);

					// Model pricing rates ($ / 1M tokens)
					const pricing = ctx.model?.cost;
					const hasPricing = pricing && (pricing.input > 0 || pricing.output > 0);
					const supportsImages = (ctx.model?.input ?? ["text"]).includes("image");
					const supportsFiles = (ctx.model?.input ?? ["text"]).includes("file");
					const modalityIcons: string[] = [];
					if (supportsImages) modalityIcons.push(dim("🖼"));
					if (supportsFiles) modalityIcons.push(dim("🗎")); // Unicode for 'MIME Document'
					const modalityIconStr = modalityIcons.join(" ");

					const pricingStr = hasPricing
						? dim(`${fmtPricing(pricing.input)}/${fmtPricing(pricing.output)}/M`)
						: "";
					const iconSuffix = modalityIconStr ? ` ${modalityIconStr}` : "";
					const modelDisplay = pricingStr
						? `${pastelYellow(modelLabel)}${iconSuffix}  ${pricingStr}`
						: `${pastelYellow(modelLabel)}${iconSuffix}`;
					const middleStr = `${modelDisplay} (${ctxLabel}) [${bar}] ${tokensLabel} ${pctColored}`;

					// ---- Section 3: tokens + session cost (Σ = accumulated) ----
					const rightStr = `↑${fmtNum(input)} ↓${fmtNum(output)} ${pastelOrange(`Δ$${lastCost.toFixed(3)}`)} ${pastelGreen(`Σ$${cost.toFixed(3)}`)}`;

					// ---- Assemble with separators ----
					const sep = dim(" | ");
					const line = `${pastelBlue(dirStr)}${sep}${middleStr}${sep}${rightStr}`;
					return [truncateToWidth(line, width)];
				},
			};
		});
	});

	pi.on("turn_end", async (event) => {
		// Accumulate across all turns within one user prompt
		lastInput += event.message.usage?.input ?? 0;
		lastOutput += event.message.usage?.output ?? 0;
		lastCost += event.message.usage?.cost?.total ?? 0;
		requestRender?.();
	});
	pi.on("message_end", async () => requestRender?.());
	pi.on("model_select", async () => requestRender?.());
}