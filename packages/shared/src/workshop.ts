export const WORKSHOP_MOD_REJECT_REASONS = [
  "on_hold",
  "incompatible",
  "covered_by_other_mod",
  "not_a_good_fit",
] as const;

// Derived locally rather than imported from ./db: the generated db types are
// built from these consts, so importing them back would require a generate
// pass before a clean checkout can typecheck
type WorkshopModRejectReason = (typeof WORKSHOP_MOD_REJECT_REASONS)[number];

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
] as const;

type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];

export const WORKSHOP_STATUS_TRANSITIONS: Record<
  WorkshopStatus,
  WorkshopStatus[]
> = {
  draft: ["open"],
  open: ["closed"],
  closed: ["open", "archived"],
  archived: ["closed"],
};
