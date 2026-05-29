import { z } from "zod";
import { adminProcedure } from "@/trpc/trpc";
import { Q } from "@/db";
import { mcUuid } from "@/utils/zod-schemas";
import { paginationInput, buildPagination } from "@/trpc/utils";

export const chunkProcedures = {
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
        sortBy: z
          .enum(["dimension", "x", "z", "forceloadable", "active"])
          .optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        ...paginationInput({ defaultLimit: 50 }),
      }),
    )
    .query(async ({ input }) => {
      const offset = input.page * input.limit;
      const filters = {
        dimension: input.dimension ?? null,
        activeOnly: input.activeOnly ?? false,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
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
};
