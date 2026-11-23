import type { DerivedStatus, StatText, StatWindows } from "./constants";
import { DAY_MS } from "@/lib/time";

export function resolveStatText(text: StatText, windows: StatWindows): string {
  return typeof text === "function" ? text(windows) : text;
}

export function deriveWarningStatus(
  warning: {
    warnedAt: string | Date;
    resolvedAt: string | Date | null;
    removedAt: string | Date | null;
  },
  graceDays: number,
): DerivedStatus {
  if (warning.removedAt) return "removed";
  if (warning.resolvedAt) return "resolved";

  const warnedAtMs = new Date(warning.warnedAt).getTime();
  const graceMs = graceDays * DAY_MS;
  return Date.now() - warnedAtMs < graceMs ? "active" : "expired";
}

export function daysUntilDeadline(
  warnedAt: string | Date,
  graceDays: number,
): number {
  const warnedAtMs = new Date(warnedAt).getTime();
  const deadlineMs = warnedAtMs + graceDays * DAY_MS;
  return Math.ceil((deadlineMs - Date.now()) / DAY_MS);
}
