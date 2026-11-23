import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { id, auditActor } from "@/trpc/utils";
import { issueBan, liftBan, listBansForUser } from "@/services/workshop/bans";
import { discordId } from "@/utils/zod-schemas";

export const adminWorkshopBansRouter = router({
  listForUser: adminProcedure
    .meta({ description: "Workshop suggestion bans issued to a user" })
    .input(
      z.object({
        discordId,
        includeInactive: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      return await listBansForUser(input.discordId, input.includeInactive);
    }),

  issue: adminProcedure
    .meta({
      description:
        "Block a user from suggesting mods, in one workshop or globally. Does not affect Minecraft, Discord, upvotes or existing suggestions",
    })
    .input(
      z.object({
        discordId,
        workshopId: id().nullable(),
        reason: z.string().trim().min(1).max(ADMIN_REASON_MAX_LENGTH),
        durationDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await issueBan(input, auditActor(ctx));
    }),

  lift: adminProcedure
    .meta({ description: "Lift a workshop suggestion ban" })
    .input(
      z.object({
        banId: id(),
        reason: z.string().trim().min(1).max(ADMIN_REASON_MAX_LENGTH),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await liftBan(input.banId, input.reason, auditActor(ctx));
    }),
});
