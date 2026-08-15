import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { rethrowTrpc, id } from "@/trpc/utils";
import { issueBan, liftBan, listBansForUser } from "@/services/workshop/bans";

const discordId = () =>
  z
    .string()
    .trim()
    .regex(/^\d{17,20}$/, "Must be a Discord ID");

export const adminWorkshopBansRouter = router({
  listForUser: adminProcedure
    .meta({ description: "Workshop suggestion bans issued to a user" })
    .input(
      z.object({
        discordId: discordId(),
        includeInactive: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await listBansForUser(input.discordId, input.includeInactive);
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  issue: adminProcedure
    .meta({
      description:
        "Block a user from suggesting mods, in one workshop or globally. Does not affect Minecraft, Discord, upvotes or existing suggestions",
    })
    .input(
      z.object({
        discordId: discordId(),
        workshopId: id().nullable(),
        reason: z.string().trim().min(1).max(500),
        durationDays: z.number().int().min(1).max(365).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await issueBan(input, {
          discordId: ctx.user.discordId,
          username: ctx.user.username,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  lift: adminProcedure
    .meta({ description: "Lift a workshop suggestion ban" })
    .input(
      z.object({
        banId: id(),
        reason: z.string().trim().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await liftBan(input.banId, input.reason, {
          discordId: ctx.user.discordId,
          username: ctx.user.username,
        });
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
