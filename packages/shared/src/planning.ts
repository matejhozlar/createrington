export const PLANNING_CATEGORIES = [
  "modpack",
  "website",
  "discord",
  "server",
] as const;

export type PlanningCategory = (typeof PLANNING_CATEGORIES)[number];

export const PLANNING_ITEM_STATUSES = [
  "inbox",
  "discussing",
  "decided",
  "building",
  "done",
  "rejected",
] as const;

export type PlanningItemStatus = (typeof PLANNING_ITEM_STATUSES)[number];

export const PLANNING_TITLE_MAX_LENGTH = 150;

export const PLANNING_TEXT_MAX_LENGTH = 10_000;

export const PLANNING_COMMENT_MAX_LENGTH = 4000;

export const PLANNING_SUBCATEGORY_NAME_MAX_LENGTH = 40;
