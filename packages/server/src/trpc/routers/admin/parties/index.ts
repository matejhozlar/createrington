import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { minecraftRcon } from "@/utils/rcon";
import { mcUuid } from "@/utils/zod-schemas";
import { paginationInput, buildPagination } from "@/trpc/utils";

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
        partyUuid: mcUuid,
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
        partyUuid: mcUuid,
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
        playerUuid: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.forceload.chunk.getChunksByPlayerUuid(
        input.serverId,
        input.playerUuid,
      );
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
        playerUuid: mcUuid,
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

  partyDetails: adminProcedure
    .meta({
      description:
        "Aggregate chunk stats for a single party (chunks claimed, forceloads, active, opted-in)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyId: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.chunk.getPartyDetailsByPartyId(
        input.serverId,
        input.partyId,
      );
    }),

  alliedParties: adminProcedure
    .meta({
      description:
        "Allied parties on a server, excluding the requesting party (for showing other allies)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyId: mcUuid,
      }),
    )
    .query(async ({ input }) => {
      return Q.server.ally.party.getAlliedPartiesForParty(
        input.serverId,
        input.partyId,
      );
    }),

  chunkKpis: adminProcedure
    .meta({ description: "Chunk-based KPIs for a server (from server_chunk)" })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.chunk.getKpis(input.serverId);
    }),

  chunkDimensions: adminProcedure
    .meta({
      description:
        "Distinct dimension IDs present in server_chunk for the dimension filter",
    })
    .input(z.object({ serverId: z.number().int() }))
    .query(async ({ input }) => {
      return Q.server.chunk.getDistinctDimensions(input.serverId);
    }),

  chunkParties: adminProcedure
    .meta({
      description:
        "Party aggregates from server_chunk with ally status, for unified parties view",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        dimension: z.string().min(1).optional(),
      }),
    )
    .query(async ({ input }) => {
      return Q.server.chunk.getPartyAggregates(
        input.serverId,
        input.dimension ?? null,
      );
    }),

  chunkPartyMembers: adminProcedure
    .meta({
      description:
        "Paginated per-player chunk stats within a party (from server_chunk)",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        partyId: mcUuid,
        ...paginationInput({ defaultLimit: 25 }),
      }),
    )
    .query(async ({ input }) => {
      const offset = input.page * input.limit;
      const [items, total] = await Promise.all([
        Q.server.chunk.getPlayerChunksByParty(input.serverId, input.partyId, {
          limit: input.limit,
          offset,
        }),
        Q.server.chunk.countPlayersByParty(input.serverId, input.partyId),
      ]);
      return {
        items,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  chunkPlayerDetail: adminProcedure
    .meta({
      description:
        "Paginated chunk rows for a player (from server_chunk), with optional dimension and active-only filters",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        playerUuid: mcUuid,
        dimension: z.string().min(1).optional(),
        activeOnly: z.boolean().optional(),
        ...paginationInput({ defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const offset = input.page * input.limit;
      const filters = {
        dimension: input.dimension ?? null,
        activeOnly: input.activeOnly ?? false,
      };
      const [items, total] = await Promise.all([
        Q.server.chunk.getChunksForPlayer(input.serverId, input.playerUuid, {
          ...filters,
          limit: input.limit,
          offset,
        }),
        Q.server.chunk.countChunksForPlayer(
          input.serverId,
          input.playerUuid,
          filters,
        ),
      ]);
      return {
        items,
        pagination: buildPagination(input.page, input.limit, total),
      };
    }),

  chunkSoloPlayers: adminProcedure
    .meta({
      description:
        "Paginated solo players (no party) with chunk aggregates, with optional name/UUID search, dimension, and active-only filter",
    })
    .input(
      z.object({
        serverId: z.number().int(),
        search: z.string().optional(),
        dimension: z.string().min(1).optional(),
        activeOnly: z.boolean().optional(),
        sortBy: z
          .enum([
            "player",
            "totalChunks",
            "forceloadableChunks",
            "activeChunks",
            "allyStatus",
            "lastSyncedAt",
          ])
          .optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        ...paginationInput({ defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const offset = input.page * input.limit;
      const filters = {
        search: input.search?.trim() || null,
        dimension: input.dimension ?? null,
        activeOnly: input.activeOnly ?? false,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
      };
      const [items, total] = await Promise.all([
        Q.server.chunk.getSoloPlayerAggregates(input.serverId, {
          ...filters,
          limit: input.limit,
          offset,
        }),
        Q.server.chunk.countSoloPlayers(input.serverId, filters),
      ]);
      return {
        items,
        pagination: buildPagination(input.page, input.limit, total),
      };
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
