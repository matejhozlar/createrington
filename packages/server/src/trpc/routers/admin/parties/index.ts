import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { minecraftRcon } from "@/utils/rcon";

export const adminPartiesRouter = router({
  kpis: adminProcedure
    .meta({ description: "Aggregate party + ally KPIs for a server" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.party.getKpis(input.serverId);
    }),

  list: adminProcedure
    .meta({
      description:
        "Unified list of forceload parties on a server, with ally status joined by stable party UUID",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.forceload.party.getUnifiedList(input.serverId);
    }),

  members: adminProcedure
    .meta({
      description:
        "Members of a party (keyed by stable party UUID) with per-member solo forceload chunk stats",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyUuid: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.party.getMembersWithChunkStats(
        input.serverId,
        input.partyUuid,
      );
    }),

  partyChunks: adminProcedure
    .meta({ description: "Chunks for a party (keyed by stable party UUID)" })
    .input(
      z.object({
        serverId: z.number().int(),
        partyUuid: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.chunk.getChunksByPartyUuid(
        input.serverId,
        input.partyUuid,
      );
    }),

  playerChunks: adminProcedure
    .meta({
      description: "Solo forceload chunks for a player (keyed by player UUID)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.chunk.getChunksByPlayerUuid(
        input.serverId,
        input.playerUuid,
      );
    }),

  qualifiedPlayers: adminProcedure
    .meta({
      description:
        "Players who have met ally trigger requirements (active or pending)",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.ally.qualified.player.getQualifiedPlayers(input.serverId);
    }),

  fakeParty: adminProcedure
    .meta({ description: "Fake-player party snapshot for a server" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.ally.fake.party.getFakePartyWithMembers(input.serverId);
    }),

  playerStatus: adminProcedure
    .meta({ description: "Ally status for a single player on a server" })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const [qualification, partyAlliance] = await Promise.all([
        Q.server.ally.qualified.player.getStatusForPlayer(
          input.serverId,
          input.playerUuid,
        ),
        Q.server.ally.qualified.player.getPartyAlliance(
          input.serverId,
          input.playerUuid,
        ),
      ]);
      return { qualification, partyAlliance };
    }),

  chunkKpis: adminProcedure
    .meta({ description: "Chunk-based KPIs for a server (from server_chunk)" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.chunk.getKpis(input.serverId);
    }),

  chunkParties: adminProcedure
    .meta({
      description:
        "Party aggregates from server_chunk with ally status, for unified parties view",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.chunk.getPartyAggregates(input.serverId);
    }),

  chunkPartyMembers: adminProcedure
    .meta({
      description: "Per-player chunk stats within a party (from server_chunk)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.chunk.getPlayerChunksByParty(
        input.serverId,
        input.partyId,
      );
    }),

  chunkPlayerDetail: adminProcedure
    .meta({
      description: "Individual chunk rows for a player (from server_chunk)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.chunk.getChunksForPlayer(
        input.serverId,
        input.playerUuid,
      );
    }),

  chunkSoloPlayers: adminProcedure
    .meta({
      description:
        "Solo players (no party) with chunk aggregates (from server_chunk)",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.chunk.getSoloPlayerAggregates(input.serverId);
    }),

  resync: adminProcedure
    .meta({
      description:
        "Dispatch /opac-fp sync over RCON to force an immediate forceload + ally resync",
    })
    .input(z.object({ serverId: z.number().int() }))
    .mutation(async ({ input }) => {
      try {
        const response = await minecraftRcon.send(
          input.serverId,
          "opac-fp sync",
        );
        return { dispatched: true, response };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Failed to dispatch sync: ${error.message}`
              : "Failed to dispatch sync",
        });
      }
    }),
});
