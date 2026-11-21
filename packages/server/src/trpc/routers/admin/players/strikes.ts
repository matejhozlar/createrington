import { z } from "zod";
import {
  ADMIN_REASON_MAX_LENGTH,
  STRIKE_DESCRIPTION_MAX_LENGTH,
} from "@createrington/shared/admin-reason";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerStrikeRepo } from "@/db";
import { id, playerId } from "@/trpc/utils";

export const strikesRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get all strikes for a player with statistics. Optionally filter to active-only",
    })
    .input(
      z.object({
        id: playerId(),
        activeOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const [strikes, statistics] = await Promise.all([
        playerStrikeRepo.getHistory(input.id, input.activeOnly),
        playerStrikeRepo.getStatistics(input.id),
      ]);

      return { strikes, statistics };
    }),

  issue: adminProcedure
    .meta({ description: "Issue a strike to a player" })
    .input(
      z.object({
        id: playerId(),
        classification: z.enum([
          "pvp",
          "theft",
          "griefing",
          "laggy_machines",
          "inappropriate_chat",
          "harassment",
          "exploiting",
          "rule_violation",
          "other",
        ]),
        description: z
          .string()
          .min(1, "Description is required")
          .max(STRIKE_DESCRIPTION_MAX_LENGTH),
        severity: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
        ]),
        serverId: id().optional(),
        metadata: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const strike = await playerStrikeRepo.issue(
        input.id,
        {
          classification: input.classification,
          description: input.description,
          severity: input.severity,
          serverId: input.serverId,
          metadata: input.metadata,
        },
        ctx.user.discordId,
        ctx.user.minecraftUsername,
      );

      return { strike };
    }),

  delete: adminProcedure
    .meta({ description: "Remove/pardon a strike from a player" })
    .input(
      z.object({
        id: z.string().min(1),
        strikeId: id(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(ADMIN_REASON_MAX_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const strike = await playerStrikeRepo.remove(
        input.strikeId,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      return { strike };
    }),
});
