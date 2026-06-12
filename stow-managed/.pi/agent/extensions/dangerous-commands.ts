/**
 * Dangerous Command Gate
 *
 * Port of .claude/hooks/catch-dangerous-commands.sh
 * Intercepts dangerous bash commands and forces user confirmation before running.
 *
 * Patterns: rm, git rm, git reset --hard, git force push, git clean -f,
 * git checkout/restore --, find -delete/exec rm, curl|wget piped to shell,
 * git branch -D, git stash drop/clear, git filter-branch, truncate, shred,
 * sudo, kill/killall
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const dangerousPatterns: RegExp[] = [
  // rm as a command (after pipe/batch operators or standalone)
  /(?:^|&&|\|\||;|\|)\s*(?:sudo\s+)?rm\s/,
  // git rm
  /(?:^|&&|\|\||;|\|)\s*git\s+rm\s/,
  // git reset --hard
  /git\s+reset\s+--hard/,
  // git force push
  /git\s+push\s+.*(?:--force|-f)(?:\s|$)/,
  // git clean -f / -fd
  /git\s+clean\s+-[a-zA-Z]*f/,
  // git checkout -- / git restore --
  /git\s+(?:checkout|restore)\s+--\s/,
  // find -delete
  /find\s+.*-delete/,
  // find -exec rm
  /find\s+.*-exec\s+(?:sudo\s+)?rm/,
  // pipe curl/wget to shell
  /(?:curl|wget)\s+.*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)(?:\s|$)/,
  // git branch -D
  /git\s+branch\s+-D/,
  // git stash drop / clear
  /git\s+stash\s+(?:drop|clear)/,
  // git filter-branch / filter-repo
  /git\s+(?:filter-branch|filter-repo)(?:\s|$)/,
  // truncate — zeros out file contents
  /(?:^|&&|\|\||;|\|)\s*(?:sudo\s+)?truncate\s/,
  // shred — secure overwrite/delete
  /(?:^|&&|\|\||;|\|)\s*(?:sudo\s+)?shred\s/,
  // sudo — any privileged command execution
  /(?:^|&&|\|\||;|\|)\s*sudo\s/,
  // kill / killall
  /(?:^|&&|\|\||;|\|)\s*(?:sudo\s+)?kill(?:all)?\s/,
];

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;

    const command = event.input.command as string;
    const isDangerous = dangerousPatterns.some((p) => p.test(command));
    if (!isDangerous) return;

    if (!ctx.hasUI) {
      return { block: true, reason: `Dangerous command blocked (no UI for confirmation): ${command}` };
    }

    const ok = await ctx.ui.confirm(
      "Dangerous command",
      `Allow this command?\n\n  ${command}`,
    );

    if (!ok) {
      return { block: true, reason: "Blocked by user" };
    }
  });
}