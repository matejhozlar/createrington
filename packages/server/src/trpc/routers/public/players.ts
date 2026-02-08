import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../../trpc";
import { idToObject } from "@/app/utils/helpers";
import { Q } from "@/db";
import {
  GetPlayerParamsSchema,
  GetPlayersQuerySchema,
  GetPlayersCountQuerySchema,
} from "@createrington/shared/api/public/players";

export const playersRouter = router({
  get: publicProcedure
    .meta({
      description:
        "Looks up a single player by Discord ID, Minecraft UUID, or Minecraft username. Returns the full player record or NOT_FOUND.",
    })
    .input(GetPlayerParamsSchema)
    .query(async ({ input }) => {
      const identifier = idToObject(input.id);
      if (!identifier) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
        });
      }

      const player = await Q.player.find(identifier);
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Player with ID ${input.id} not found`,
        });
      }

      return player;
    }),

  getAll: publicProcedure
    .meta({
      description:
        "Returns a paginated list of players with optional filters (discordId, minecraftUuid, minecraftUsername, isActive) and sorting. Response includes players array and pagination metadata.",
    })
    .input(GetPlayersQuerySchema)
    .query(async ({ input }) => {
      const filters: any = {};
      if (input.discordId) filters.discordId = input.discordId;
      if (input.minecraftUuid) filters.minecraftUuid = input.minecraftUuid;
      if (input.minecraftUsername) {
        filters.minecraftUsername = {
          $ilike: `%${input.minecraftUsername}%`,
        };
      }
      if (input.isActive !== undefined) filters.isActive = input.isActive;

      const [players, total] = await Promise.all([
        Q.player.findAll(filters, {
          orderBy: input.orderBy,
          orderDirection: input.orderDirection,
          limit: input.limit,
          offset: input.page * input.limit,
        }),
        Q.player.count(filters),
      ]);

      return {
        players,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  count: publicProcedure
    .meta({
      description:
        "Returns a count of players matching optional filters (online status, server, registration date range, last seen). Used for dashboard metrics.",
    })
    .input(GetPlayersCountQuerySchema)
    .query(async ({ input }) => {
      const filters: any = {};

      if (input.online !== undefined) filters.online = input.online;
      if (input.currentServerId !== undefined) {
        filters.currentServerId = input.currentServerId;
      }
      if (input.createdAfter) {
        filters.createdAt = { $gte: new Date(input.createdAfter) };
      }
      if (input.createdBefore) {
        filters.createdAt = {
          ...filters.createdAt,
          $lte: new Date(input.createdBefore),
        };
      }
      if (input.lastSeenAfter) {
        filters.lastSeen = { $gte: new Date(input.lastSeenAfter) };
      }

      const count = await Q.player.count(filters);

      return { count };
    }),
});
