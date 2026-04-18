import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { parsePlayerId, trpcError } from "@/trpc/utils";

/** Admin minecraft stats router — fetch per-server JSONB stats for a player, and search stats across all players. */
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

  /** Search for item keys matching a query string across all categories. */
  searchItems: adminProcedure
    .meta({ description: "Autocomplete search for item keys" })
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      return Q.player.minecraft.stats.searchItems(input.query);
    }),

  /** Compare a single item across multiple categories for all players. */
  compare: adminProcedure
    .meta({
      description:
        "Compare one item across multiple categories (e.g. picked_up vs crafted)",
    })
    .input(
      z.object({
        item: z.string().min(1),
        categories: z.array(z.string().min(1)).min(1).max(9),
        limit: z.number().int().min(1).max(500).default(200),
      }),
    )
    .query(async ({ input }) => {
      return Q.player.minecraft.stats.compareItem(
        input.item,
        input.categories,
        { limit: input.limit },
      );
    }),
});
