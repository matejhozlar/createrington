import type { RouterOutput } from "@/lib/trpc";

type Planning = RouterOutput["admin"]["planning"];

export type PlanningItem = Planning["items"]["list"]["items"][number];
export type PlanningItemDetail = Planning["items"]["get"]["item"];
export type PlanningComment = Planning["items"]["get"]["comments"][number];
export type PlanningRevision = Planning["items"]["get"]["revisions"][number];
export type PlanningSubcategory =
  Planning["subcategories"]["list"]["subcategories"][number];
export type PlanningPerson = Planning["admins"]["list"]["admins"][number];
