import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock, UserX } from "lucide-react";

export type WarningStatusFilter =
  | "all"
  | "active"
  | "expired"
  | "resolved"
  | "removed";

export const STATUS_FILTER_OPTIONS: {
  value: WarningStatusFilter;
  label: string;
}[] = [
  { value: "all", label: "All Warnings" },
  { value: "active", label: "Active (In Grace)" },
  { value: "expired", label: "Expired (Overdue)" },
  { value: "resolved", label: "Resolved" },
  { value: "removed", label: "Removed" },
];

export type DerivedStatus = "active" | "expired" | "resolved" | "removed";

export const STATUS_LABELS: Record<DerivedStatus, string> = {
  active: "Active",
  expired: "Overdue",
  resolved: "Resolved",
  removed: "Removed",
};

/**
 * Tailwind class fragments applied to a Badge to render each status
 * with consistent colors. Matches the existing admin-tool color language
 * (success/warning/destructive/muted).
 */
export const STATUS_BADGE_CLASSES: Record<DerivedStatus, string> = {
  active: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
  expired: "border-destructive bg-destructive/10 text-destructive",
  resolved: "border-success bg-success/10 text-success",
  removed:
    "border-muted-foreground bg-muted-foreground/10 text-muted-foreground",
};

export const STAT_CARDS: {
  key: "active" | "expired" | "resolvedLast30d" | "removedLast30d";
  label: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}[] = [
  {
    key: "active",
    label: "Active Warnings",
    description: "In 14-day grace period",
    icon: Clock,
    iconBg: "bg-yellow-500/10",
    iconColor: "text-yellow-500",
  },
  {
    key: "expired",
    label: "Overdue",
    description: "Past grace, queued for removal",
    icon: AlertTriangle,
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  {
    key: "resolvedLast30d",
    label: "Resolved (30d)",
    description: "Players who returned",
    icon: CheckCircle2,
    iconBg: "bg-success/10",
    iconColor: "text-success",
  },
  {
    key: "removedLast30d",
    label: "Removed (30d)",
    description: "Kicked after grace",
    icon: UserX,
    iconBg: "bg-muted-foreground/10",
    iconColor: "text-muted-foreground",
  },
];

/**
 * Derives the display status of a warning from its timestamps.
 * Matches the backend status semantics in the query layer.
 *
 * @param warning - Warning row with timestamps
 * @param graceDays - Grace window in days (should come from the
 *   `capabilities` query so the UI tracks the server-side constant)
 */
export function deriveWarningStatus(
  warning: {
    warnedAt: string | Date;
    resolvedAt: string | Date | null;
    removedAt: string | Date | null;
  },
  graceDays = 14,
): DerivedStatus {
  if (warning.removedAt) return "removed";
  if (warning.resolvedAt) return "resolved";

  const warnedAtMs = new Date(warning.warnedAt).getTime();
  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  return Date.now() - warnedAtMs < graceMs ? "active" : "expired";
}

/**
 * Returns the number of days remaining in the grace period (negative if
 * already expired). Used for the "X days left" display on active rows.
 */
export function daysUntilDeadline(
  warnedAt: string | Date,
  graceDays = 14,
): number {
  const warnedAtMs = new Date(warnedAt).getTime();
  const deadlineMs = warnedAtMs + graceDays * 24 * 60 * 60 * 1000;
  return Math.ceil((deadlineMs - Date.now()) / (24 * 60 * 60 * 1000));
}
