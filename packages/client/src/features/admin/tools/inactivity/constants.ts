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

export const DEFAULT_STAT_WINDOWS: StatWindows = {
  graceDays: 14,
  retentionDays: 30,
};

export type StatText = string | ((windows: StatWindows) => string);

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
