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

export const WORKSHOP_MOD_STATUSES = [
  "pending",
  "approved",
  "testing",
  "next_update",
  "in_pack",
  "rejected",
] as const;

type WorkshopModStatus = (typeof WORKSHOP_MOD_STATUSES)[number];

export const WORKSHOP_MOD_REVIEW_ACTIONS = [
  "approve",
  "start_testing",
  "send_back",
  "reject",
] as const;

type WorkshopModReviewAction = (typeof WORKSHOP_MOD_REVIEW_ACTIONS)[number];

// Reviews never land on pending (nothing un-suggests a mod) or in_pack, which
// reconcile owns: it follows the published pack manifest rather than an admin
type WorkshopModReviewTarget = Exclude<
  WorkshopModStatus,
  "pending" | "in_pack"
>;

// Where each review action takes a mod, keyed by the status it starts from.
// A missing action is one that does not apply at that stage, so this table is
// both the pipeline's documentation and the rule reviewMod enforces.
export const WORKSHOP_MOD_REVIEW_TARGETS: Record<
  WorkshopModStatus,
  Partial<Record<WorkshopModReviewAction, WorkshopModReviewTarget>>
> = {
  pending: { approve: "approved", reject: "rejected" },
  approved: { start_testing: "testing", reject: "rejected" },
  testing: {
    approve: "next_update",
    send_back: "approved",
    reject: "rejected",
  },
  next_update: { send_back: "testing", reject: "rejected" },
  in_pack: { reject: "rejected" },
  // Re-rejecting is how a reason gets edited
  rejected: { approve: "approved", reject: "rejected" },
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
