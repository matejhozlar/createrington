import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../../trpc";
import { Q } from "@/db";
import { z } from "zod";
import { parsePlayerId } from "../../utils";

export const playersRouter = router({
  get: publicProcedure
    .meta({
      description:
        "Looks up a single player by Discord ID, Minecraft UUID, or Minecraft username. Returns the full player record or NOT_FOUND.",
    })
    .input(
      z.object({
        id: z.string().min(1, "Player ID is required"),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

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
    .input(
      z.object({
        // Filtering
        discordId: z.string().optional(),
        minecraftUuid: z.string().optional(),
        minecraftUsername: z.string().optional(),
        isActive: z.enum(["true"], "false").transform((val) => val === "true"),

        // Pagination
        page: z.coerce.number().int().positive().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(20),

        // Sorting
        orderBy: z
          .enum(["createdAt", "minecraftUsername", "updatedAt"])
          .default("createdAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
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
    .input(
      z.object({
        online: z
          .enum(["true", "false"])
          .transform((val) => val === "true")
          .optional(),
        currentServerId: z.coerce.number().int().positive().optional(),
        createdAfter: z.iso.datetime().optional(),
        createdBefore: z.iso.datetime().optional(),
        lastSeenAfter: z.iso.datetime().optional(),
      }),
    )
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
