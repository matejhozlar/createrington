import { Q } from "@/db";
import type {
  CurseforgeProject,
  ModEnvironment,
  WorkshopMod,
  WorkshopModRejectReason,
} from "@createrington/shared/db";
import {
  MOD_ENVIRONMENT_LABELS,
  type WorkshopModReviewAction,
} from "@createrington/shared/workshop";

export type WorkshopAuditSource = "sandbox";

export interface WorkshopAuditActor {
  adminDiscordId: string;
  adminUsername: string;
  source?: WorkshopAuditSource;
}

function describe(actor: WorkshopAuditActor, text: string): string {
  return actor.source ? `${text} via ${actor.source}` : text;
}

function metadata(
  actor: WorkshopAuditActor,
  data: Record<string, unknown>,
): Record<string, unknown> {
  return actor.source ? { ...data, source: actor.source } : data;
}

/** Admin action log entry for a workshop mod review, shared by every surface that reviews mods. */
export async function logModReview(
  actor: WorkshopAuditActor,
  input: {
    workshopModId: number;
    action: WorkshopModReviewAction;
    reason?: WorkshopModRejectReason;
    note?: string;
  },
  mod: WorkshopMod,
): Promise<void> {
  await Q.admin.log.action.logAction({
    adminDiscordId: actor.adminDiscordId,
    adminUsername: actor.adminUsername,
    actionType: `workshop_mod_${input.action}`,
    description: describe(
      actor,
      `Reviewed workshop mod #${input.workshopModId}: ${input.action}`,
    ),
    reason: [input.reason, input.note].filter(Boolean).join(": "),
    metadata: metadata(actor, {
      workshopModId: input.workshopModId,
      curseforgeProjectId: mod.curseforgeProjectId,
      status: mod.status,
    }),
  });
}

/** Admin action log entry for choosing whether a queued mod ships enabled or disabled. */
export async function logModRequired(
  actor: WorkshopAuditActor,
  mod: WorkshopMod,
  projectName: string,
): Promise<void> {
  await Q.admin.log.action.logAction({
    adminDiscordId: actor.adminDiscordId,
    adminUsername: actor.adminUsername,
    actionType: "workshop_mod_required",
    description: describe(
      actor,
      `Set "${projectName}" to ship ${mod.required ? "enabled" : "disabled"} in the next update`,
    ),
    metadata: metadata(actor, {
      workshopModId: mod.id,
      curseforgeProjectId: mod.curseforgeProjectId,
      required: mod.required,
    }),
  });
}

/** Admin action log entry for flagging a project's environment. */
export async function logProjectEnvironment(
  actor: WorkshopAuditActor,
  project: CurseforgeProject,
  environment: ModEnvironment,
): Promise<void> {
  await Q.admin.log.action.logAction({
    adminDiscordId: actor.adminDiscordId,
    adminUsername: actor.adminUsername,
    actionType: "workshop_project_environment",
    description: describe(
      actor,
      `Flagged "${project.name}" as ${MOD_ENVIRONMENT_LABELS[environment]}`,
    ),
    metadata: metadata(actor, {
      curseforgeProjectId: project.id,
      environment,
    }),
  });
}
