/**
 * hook-logger.ts — shared logging for pi extension hooks.
 *
 * Writes JSONL records to ~/.local/share/hook-analytics/hooks.jsonl.
 * Schema matches hook-logger.sh byte-for-byte:
 *   { ts, harness: "pi", hook, event, outcome, reason, duration_ms, exit_code }
 *
 * DESIGNED TO FAIL SILENTLY: if the log directory is unwritable, this
 * module degrades to no-ops. withHookLogging becomes a transparent
 * pass-through — the hook's safety function is never affected.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const LOG_FILE = join(homedir(), ".local", "share", "hook-analytics", "hooks.jsonl");

// ── Self-test: can we write? ──────────────────────────────────────────

let _writable = false;
try {
  mkdirSync(dirname(LOG_FILE), { recursive: true });
  appendFileSync(LOG_FILE, ""); // touch — verifies writability without corrupting JSONL
  _writable = true;
} catch {
  // Disk full, permissions, etc. Logging is silently disabled.
}

// ── Types ─────────────────────────────────────────────────────────────

export interface HookLogEntry {
  ts: string;
  harness: "pi";
  hook: string;
  event: string;
  outcome: string;
  reason: string;
  duration_ms: number;
  exit_code: number;
}

// ── Core ──────────────────────────────────────────────────────────────

/** Append one log record. Silent on failure. */
export function logHook(entry: HookLogEntry): void {
  if (!_writable) return;
  try {
    appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // best-effort
  }
}

/**
 * Wraps an async pi event handler so start/end logging is automatic.
 *
 * If the logger is unwritable, returns the handler unchanged — zero overhead
 * and zero impact on the hook's safety function.
 *
 * Outcome detection:
 *   - returns undefined         → "passed"
 *   - returns { block: true }   → "blocked" (reason from .reason)
 *   - returns { permissionDecision: "ask"|"deny"|"allow" } → that value
 *   - throws                    → "error" (reason from error message, exit_code 1)
 */
export function withHookLogging<T extends (...args: any[]) => any>(
  hookName: string,
  eventName: string,
  handler: T,
): (...args: Parameters<T>) => ReturnType<T> {
  if (!_writable) return handler as any;

  return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    const start = Date.now();
    try {
      const result = await handler(...args);
      const duration = Date.now() - start;

      let outcome = "passed";
      let reason = "";

      if (result !== undefined && result !== null) {
        if (result.block === true) {
          outcome = "blocked";
          reason = typeof result.reason === "string" ? result.reason : "";
        } else if (typeof result.permissionDecision === "string") {
          outcome = result.permissionDecision;
          reason = typeof result.permissionDecisionReason === "string"
            ? result.permissionDecisionReason : "";
        } else {
          outcome = "handled";
        }
      }

      logHook({
        ts: new Date().toISOString(),
        harness: "pi",
        hook: hookName,
        event: eventName,
        outcome,
        reason,
        duration_ms: duration,
        exit_code: 0,
      });

      return result;
    } catch (e) {
      logHook({
        ts: new Date().toISOString(),
        harness: "pi",
        hook: hookName,
        event: eventName,
        outcome: "error",
        reason: String(e),
        duration_ms: Date.now() - start,
        exit_code: 1,
      });
      throw e;
    }
  }) as any;
}