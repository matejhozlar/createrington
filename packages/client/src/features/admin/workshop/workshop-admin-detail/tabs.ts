import {
  Ban,
  CalendarClock,
  Check,
  FlaskConical,
  Lightbulb,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WorkshopModStatus } from "@createrington/shared/db";

export const WORKSHOP_TAB_IDS = [
  "review",
  "approved",
  "testing",
  "next-update",
  "in-pack",
  "ruled-out",
  "all",
  "dependencies",
  "issues",
  "releases",
] as const;

export type WorkshopTabId = (typeof WORKSHOP_TAB_IDS)[number];

export function isWorkshopTabId(value: string | null): value is WorkshopTabId {
  return WORKSHOP_TAB_IDS.includes(value as WorkshopTabId);
}

export const MOD_TAB_IDS = [
  "review",
  "approved",
  "testing",
  "next-update",
  "in-pack",
  "ruled-out",
  "all",
] as const satisfies readonly WorkshopTabId[];

export type ModTabId = (typeof MOD_TAB_IDS)[number];

export function isModTab(tab: WorkshopTabId): tab is ModTabId {
  return MOD_TAB_IDS.includes(tab as ModTabId);
}

export const TOP_TAB_IDS = [
  "mods",
  "dependencies",
  "issues",
  "releases",
] as const;

export type TopTabId = (typeof TOP_TAB_IDS)[number];

export function tabGroup(tab: WorkshopTabId): TopTabId {
  return isModTab(tab) ? "mods" : tab;
}

export type StageId = Extract<
  WorkshopTabId,
  "review" | "approved" | "testing" | "next-update" | "ruled-out"
>;

export type StageColumn =
  "note" | "upvotes" | "dependencies" | "file" | "reason";

export const STAGE_CONFIG: Record<
  StageId,
  {
    status: WorkshopModStatus;
    title: string;
    emptyIcon: LucideIcon;
    emptyMessage: string;
    dateHeader: string;
    dateField: "createdAt" | "reviewedAt";
    columns: readonly StageColumn[];
  }
> = {
  review: {
    status: "pending",
    title: "In Review",
    emptyIcon: Lightbulb,
    emptyMessage: "No suggestions waiting for review",
    dateHeader: "Suggested",
    dateField: "createdAt",
    columns: ["note", "upvotes", "dependencies"],
  },
  approved: {
    status: "approved",
    title: "Approved",
    emptyIcon: Check,
    emptyMessage: "Nothing approved yet",
    dateHeader: "Approved",
    dateField: "reviewedAt",
    columns: ["upvotes", "dependencies"],
  },
  testing: {
    status: "testing",
    title: "Testing",
    emptyIcon: FlaskConical,
    emptyMessage: "Nothing in testing",
    dateHeader: "Testing Since",
    dateField: "reviewedAt",
    columns: ["dependencies"],
  },
  "next-update": {
    status: "next_update",
    title: "Next Update",
    emptyIcon: CalendarClock,
    emptyMessage: "Nothing staged for the next update",
    dateHeader: "Staged",
    dateField: "reviewedAt",
    columns: ["file"],
  },
  "ruled-out": {
    status: "rejected",
    title: "Ruled Out",
    emptyIcon: Ban,
    emptyMessage: "Nothing ruled out",
    dateHeader: "Rejected",
    dateField: "reviewedAt",
    columns: ["reason"],
  },
};

export function isStageTab(tab: WorkshopTabId): tab is StageId {
  return tab in STAGE_CONFIG;
}
