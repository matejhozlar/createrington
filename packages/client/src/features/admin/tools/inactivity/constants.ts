import type { LucideIcon } from "lucide-react";
import type { StatTone } from "@/components/stat-card";
import type { BadgeTone } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, UserX } from "lucide-react";

export type WarningStatusFilter =
  "all" | "active" | "expired" | "resolved" | "removed";

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

export const STATUS_TONES: Record<DerivedStatus, BadgeTone> = {
  active: "warning",
  expired: "danger",
  resolved: "success",
  removed: "neutral",
};

export interface StatWindows {
  graceDays: number;
  retentionDays: number;
}

type StatText = string | ((windows: StatWindows) => string);

export function resolveStatText(text: StatText, windows: StatWindows): string {
  return typeof text === "function" ? text(windows) : text;
}

export const STAT_CARDS: {
  key: "active" | "expired" | "resolvedInRetention" | "removedInRetention";
  label: StatText;
  description: StatText;
  icon: LucideIcon;
  tone: StatTone;
}[] = [
  {
    key: "active",
    label: "Active Warnings",
    description: ({ graceDays }) => `In ${graceDays}-day grace period`,
    icon: Clock,
    tone: "warning",
  },
  {
    key: "expired",
    label: "Overdue",
    description: "Past grace, queued for removal",
    icon: AlertTriangle,
    tone: "destructive",
  },
  {
    key: "resolvedInRetention",
    label: ({ retentionDays }) => `Resolved (${retentionDays}d)`,
    description: "Players who returned",
    icon: CheckCircle2,
    tone: "success",
  },
  {
    key: "removedInRetention",
    label: ({ retentionDays }) => `Removed (${retentionDays}d)`,
    description: "Kicked after grace",
    icon: UserX,
    tone: "muted",
  },
];

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

export function daysUntilDeadline(
  warnedAt: string | Date,
  graceDays = 14,
): number {
  const warnedAtMs = new Date(warnedAt).getTime();
  const deadlineMs = warnedAtMs + graceDays * 24 * 60 * 60 * 1000;
  return Math.ceil((deadlineMs - Date.now()) / (24 * 60 * 60 * 1000));
}
