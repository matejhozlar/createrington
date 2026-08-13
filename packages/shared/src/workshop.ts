// CurseForge file dependency relationTypes
export const OPTIONAL_DEPENDENCY = 2;
export const REQUIRED_DEPENDENCY = 3;

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

// Not exported: shared/db already exports a generated WorkshopModStatus and
// the package barrel re-exports both modules
type WorkshopModStatus = (typeof WORKSHOP_MOD_STATUSES)[number];

export const WORKSHOP_MOD_STATUS_LABELS: Record<WorkshopModStatus, string> = {
  pending: "In review",
  approved: "Approved",
  testing: "In testing",
  next_update: "Coming next update",
  in_pack: "In the pack",
  rejected: "Ruled out",
};

export const WORKSHOP_MOD_EVENT_TYPES = [
  "suggested",
  "withdrawn",
  "approved",
  "rejected",
  "testing_started",
  "sent_back",
  "shipped",
  "dropped",
] as const;

export const WORKSHOP_MOD_REVIEW_ACTIONS = [
  "approve",
  "start_testing",
  "send_back",
  "reject",
] as const;

export type WorkshopModReviewAction =
  (typeof WORKSHOP_MOD_REVIEW_ACTIONS)[number];

export const WORKSHOP_MOD_REVIEW_ACTION_LABELS: Record<
  WorkshopModReviewAction,
  string
> = {
  approve: "approve",
  start_testing: "start testing",
  send_back: "send back",
  reject: "reject",
};

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
  "locked",
  "closed",
  "archived",
] as const;

type WorkshopStatus = (typeof WORKSHOP_STATUSES)[number];

export const WORKSHOP_STATUS_TRANSITIONS: Record<
  WorkshopStatus,
  WorkshopStatus[]
> = {
  draft: ["open"],
  open: ["locked", "closed"],
  locked: ["open", "closed"],
  closed: ["open", "archived"],
  archived: ["closed"],
};

// Statuses a workshop is still featured and participated in under. Locked
// keeps everything about an open workshop except the intake of new mods.
export const WORKSHOP_LIVE_STATUSES: readonly WorkshopStatus[] = [
  "open",
  "locked",
];

// Statuses users may see; anything else reads as missing, not as hidden.
export const WORKSHOP_VISIBLE_STATUSES: readonly WorkshopStatus[] = [
  "open",
  "locked",
  "closed",
];
