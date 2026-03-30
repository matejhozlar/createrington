import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { parsePlayerId, trpcError } from "@/trpc/utils";

/** Admin minecraft stats router — fetch per-server JSONB stats for a player. */
export const minecraftStatsRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get all minecraft stats entries for a player (one per server)",
    })
    .input(
      z.object({
        id: z.string().min(1),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      // Resolve to full player to get minecraftUuid
      const player = await Q.player.find(identifier);
      if (!player) {
        throw trpcError.notFound("Player not found");
      }

      const stats = await Q.player.minecraft.stats.findAll(
        { minecraftUuid: player.minecraftUuid },
        { orderBy: "serverId", orderDirection: "asc" },
      );

      return {
        stats: stats.map((s) => ({
          minecraftUuid: s.minecraftUuid,
          serverId: s.serverId,
          stats: s.stats as Record<string, Record<string, number>>,
          dataVersion: s.dataVersion,
          updatedAt: s.updatedAt.toISOString(),
        })),
      };
    }),
});
