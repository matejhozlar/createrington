import { z } from "zod";

// CurseForge file dependency relationTypes
export const OPTIONAL_DEPENDENCY = 2;
export const REQUIRED_DEPENDENCY = 3;

export const CURSEFORGE_CLASSES = {
  mods: 6,
  modpacks: 4471,
  resourcePacks: 12,
  shaders: 6552,
  dataPacks: 6945,
} as const;

export const CURSEFORGE_CLASS_LABELS: Record<number, string> = {
  [CURSEFORGE_CLASSES.mods]: "Mod",
  [CURSEFORGE_CLASSES.modpacks]: "Modpack",
  [CURSEFORGE_CLASSES.resourcePacks]: "Resource pack",
  [CURSEFORGE_CLASSES.shaders]: "Shader",
  [CURSEFORGE_CLASSES.dataPacks]: "Data pack",
};

export function curseforgeClassLabel(classId: number): string {
  return CURSEFORGE_CLASS_LABELS[classId] ?? `Class ${classId}`;
}

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

// Which side(s) a mod runs on. CurseForge's author-assigned file flags feed
// low-trust cf_flag hints, the published pack confirms those as manifest
// values, and manual admin flags always win. Unspecified mods ship to both
// sides and are surfaced for review.
export const MOD_ENVIRONMENTS = [
  "client",
  "server",
  "both",
  "unspecified",
] as const;

export const MOD_ENVIRONMENT_SOURCES = [
  "cf_flag",
  "manifest",
  "manual",
] as const;

type ModEnvironment = (typeof MOD_ENVIRONMENTS)[number];

export const MOD_ENVIRONMENT_LABELS: Record<ModEnvironment, string> = {
  client: "Client",
  server: "Server",
  both: "Client & Server",
  unspecified: "Not specified",
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
  // A live mod leaves the pack via a release drop, never through review
  in_pack: {},
  // Re-rejecting is how a reason gets edited
  rejected: { approve: "approved", reject: "rejected" },
};

// Where a dependency stands relative to the pack: already published, staged
// for the next update, still in review, ruled out, or nowhere yet. Only
// missing and rejected mean the pack cannot ship complete.
export type DependencyCoverage =
  "published" | "staged" | "in_review" | "rejected" | "missing";

// The single definition of "blocked from testing": a required dependency whose
// suggestion is currently ruled out. Server gate and client grid both use this.
export function hasRuledOutRequiredDependency(
  dependencies: Array<{ relationType: number; coverage: DependencyCoverage }>,
): boolean {
  return dependencies.some(
    (dep) =>
      dep.relationType === REQUIRED_DEPENDENCY && dep.coverage === "rejected",
  );
}

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

// The manifest.json inside a CurseForge pack export; unknown keys are stripped
export const modpackManifestUploadSchema = z.object({
  version: z.string().trim().max(120).optional(),
  minecraft: z
    .object({
      version: z.string().trim().max(20).optional(),
      modLoaders: z
        .array(
          z.object({
            id: z.string().trim().max(120),
            primary: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  // Real CurseForge exports repeat a project across entries when it ships more
  // than one file, so duplicates are deduped on import rather than rejected
  files: z
    .array(
      z.object({
        projectID: z.number().int().positive().max(2147483647),
        required: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(2000),
});

export type ModpackManifestUpload = z.infer<typeof modpackManifestUploadSchema>;
