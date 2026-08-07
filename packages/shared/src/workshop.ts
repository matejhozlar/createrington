import type { WorkshopModRejectReason, WorkshopStatus } from "./db";

export const WORKSHOP_MOD_REJECT_REASONS = [
  "on_hold",
  "incompatible",
  "covered_by_other_mod",
  "not_a_good_fit",
] as const;

export const WORKSHOP_MOD_REJECT_REASON_LABELS: Record<
  WorkshopModRejectReason,
  string
> = {
  on_hold: "On hold",
  incompatible: "Incompatible",
  covered_by_other_mod: "Covered by another mod",
  not_a_good_fit: "Not a good fit",
};

export const WORKSHOP_STATUSES = [
  "draft",
  "open",
  "closed",
  "archived",
] as const satisfies readonly WorkshopStatus[];

export const WORKSHOP_STATUS_TRANSITIONS: Record<
  WorkshopStatus,
  WorkshopStatus[]
> = {
  draft: ["open"],
  open: ["closed"],
  closed: ["open", "archived"],
  archived: ["closed"],
};
