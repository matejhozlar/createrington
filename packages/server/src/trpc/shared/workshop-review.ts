import { z } from "zod";
import { Q } from "@/db";
import { auditActor, id } from "@/trpc/utils";
import {
  WORKSHOP_MOD_REJECT_REASONS,
  WORKSHOP_MOD_REVIEW_ACTIONS,
} from "@createrington/shared/workshop";
import type { WorkshopMod } from "@createrington/shared/db";

/** Input for a mod review: an action, plus a reason (required for reject) and note. */
export const workshopModReviewInput = z
  .object({
    workshopModId: id(),
    action: z.enum(WORKSHOP_MOD_REVIEW_ACTIONS),
    reason: z.enum(WORKSHOP_MOD_REJECT_REASONS).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "reject" && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Rejecting requires a reason",
      });
    }
  });

export type WorkshopModReviewInput = z.infer<typeof workshopModReviewInput>;

/** Write the admin audit entry for a mod review; `source` tags where it came from. */
export async function logModReview(
  ctx: { user: { discordId: string; minecraftUsername: string } },
  input: WorkshopModReviewInput,
  mod: Pick<WorkshopMod, "curseforgeProjectId" | "status">,
  source?: string,
): Promise<void> {
  await Q.admin.log.action.logAction({
    ...auditActor(ctx),
    actionType: `workshop_mod_${input.action}`,
    description: `Reviewed workshop mod #${input.workshopModId}: ${input.action}`,
    reason: [input.reason, input.note].filter(Boolean).join(": ") || undefined,
    metadata: {
      ...(source ? { source } : {}),
      workshopModId: input.workshopModId,
      curseforgeProjectId: mod.curseforgeProjectId,
      status: mod.status,
    },
  });
}
