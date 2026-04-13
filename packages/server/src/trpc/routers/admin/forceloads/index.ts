import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { MINECRAFT_SERVERS } from "@/services/playtime/config";

export const adminForceloadsRouter = router({
  stats: adminProcedure
    .meta({ description: "Forceload stats per server or aggregated" })
    .input(z.object({ serverId: z.number().int().optional() }))
    .query(async ({ input }) => {
      const serverIds = input.serverId
        ? [input.serverId]
        : Object.keys(MINECRAFT_SERVERS).map(Number);

      const stats = await Promise.all(
        serverIds.map((id) => Q.server.forceload.player.getStats(id)),
      );

      if (input.serverId) {
        return stats[0];
      }

      return stats.reduce(
        (acc, s) => ({
          totalPlayers: acc.totalPlayers + s.totalPlayers,
          totalParties: acc.totalParties + s.totalParties,
          totalChunks: acc.totalChunks + s.totalChunks,
          activeChunks: acc.activeChunks + s.activeChunks,
        }),
        { totalPlayers: 0, totalParties: 0, totalChunks: 0, activeChunks: 0 },
      );
    }),

  players: adminProcedure
    .meta({ description: "List solo players with forceload chunk counts" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.player.getPlayersWithChunks(input.serverId);
    }),

  parties: adminProcedure
    .meta({ description: "List parties with forceload stats" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.party.getPartiesWithStats(input.serverId);
    }),

  chunks: adminProcedure
    .meta({ description: "Get chunks for a specific player or party" })
    .input(
      z.object({
        ownerId: z.number().int(),
        ownerType: z.enum(["player", "party"]),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.chunk.getChunksByOwner(
        input.ownerId,
        input.ownerType,
      );
    }),

  partyMembers: adminProcedure
    .meta({ description: "Get members of a forceload party" })
    .input(z.object({ partyId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.party.getPartyMembers(input.partyId);
    }),
});
