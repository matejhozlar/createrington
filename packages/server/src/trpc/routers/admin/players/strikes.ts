import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { parsePlayerId } from "@/trpc/utils";

/** Admin strikes router — list, issue, and remove player strikes. */
export const strikesRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get all strikes for a player with statistics. Optionally filter to active-only",
    })
    .input(
      z.object({
        id: z.string().min(1),
        activeOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const [strikes, statistics] = await Promise.all([
        playerService.strikes.get(identifier, input.activeOnly),
        playerService.strikes.getStatistics(identifier),
      ]);

      return { strikes, statistics };
    }),

  issue: adminProcedure
    .meta({ description: "Issue a strike to a player" })
    .input(
      z.object({
        id: z.string().min(1),
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
        description: z.string().min(1, "Description is required"),
        severity: z.union([
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
        ]),
        serverId: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);

      const strike = await playerService.strikes.issue(
        identifier,
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

  remove: adminProcedure
    .meta({ description: "Remove/pardon a strike from a player" })
    .input(
      z.object({
        id: z.string().min(1),
        strikeId: z.number().int().positive(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const strike = await playerService.strikes.remove(
        input.strikeId,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      return { strike };
    }),
});
