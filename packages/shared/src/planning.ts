import { z } from "zod";

export const PLANNING_CATEGORIES = [
  "modpack",
  "website",
  "discord",
  "server",
] as const;

export type PlanningCategory = (typeof PLANNING_CATEGORIES)[number];

export const PLANNING_ITEM_STATUSES = ["draft", "open", "approved"] as const;

export type PlanningItemStatus = (typeof PLANNING_ITEM_STATUSES)[number];

export const PLANNING_TITLE_MAX_LENGTH = 150;

export const PLANNING_TEXT_MAX_LENGTH = 10_000;

export const PLANNING_COMMENT_MAX_LENGTH = 4000;

export const PLANNING_SUBCATEGORY_NAME_MAX_LENGTH = 40;

export const planningTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLANNING_TITLE_MAX_LENGTH);

export const planningTextSchema = z
  .string()
  .trim()
  .max(PLANNING_TEXT_MAX_LENGTH)
  .transform((value) => value || null)
  .nullable();

export const planningCommentSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLANNING_COMMENT_MAX_LENGTH);
