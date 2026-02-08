import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, adminProcedure } from "../../trpc";
import { playerService } from "@/services/player";
import { Q } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { parsePlayerId } from "../../utils";

export const playersRouter = router({
  stats: adminProcedure
    .meta({ description: "Get overall player statistics for the admin dashboard." })
    .query(async () => {
      return await playerService.core.getStats();
    }),

  list: adminProcedure
    .meta({
      description:
        "List players with filtering, pagination, sorting, and optional strike/ban count enrichment.",
    })
    .input(
      z.object({
        discordId: z.string().optional(),
        minecraftUuid: z.string().optional(),
        minecraftUsername: z.string().optional(),
        online: z.boolean().optional(),
        hasStrikes: z.boolean().optional(),
        hasBans: z.boolean().optional(),
        hasViolations: z.boolean().optional(),
        page: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(20),
        orderBy: z
          .enum(["createdAt", "minecraftUsername", "updatedAt", "lastSeen"])
          .default("createdAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
        includeStrikeCounts: z.boolean().default(false),
        includeBanCounts: z.boolean().default(false),
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
      if (input.online !== undefined) filters.online = input.online;

      if (
        input.hasStrikes !== undefined ||
        input.hasBans !== undefined ||
        input.hasViolations !== undefined
      ) {
        const fetchStrikes =
          input.hasStrikes === true || input.hasViolations === true;
        const fetchBans =
          input.hasBans === true || input.hasViolations === true;

        const [uuidsWithStrikes, uuidsWithBans] = await Promise.all([
          fetchStrikes
            ? Q.player.strike.getPlayersWithActiveStrikes()
            : Promise.resolve([]),
          fetchBans
            ? Q.player.ban.getPlayersWithActiveBans()
            : Promise.resolve([]),
        ]);

        let uuidsWithViolations: string[];

        if (input.hasViolations === true) {
          uuidsWithViolations = [
            ...new Set([...uuidsWithStrikes, ...uuidsWithBans]),
          ];
        } else if (input.hasStrikes === true && input.hasBans === true) {
          uuidsWithViolations = uuidsWithStrikes.filter((uuid) =>
            uuidsWithBans.includes(uuid),
          );
        } else if (input.hasStrikes === true) {
          uuidsWithViolations = uuidsWithStrikes;
        } else if (input.hasBans === true) {
          uuidsWithViolations = uuidsWithBans;
        } else {
          uuidsWithViolations = [];
        }

        if (uuidsWithViolations.length === 0) {
          return {
            players: [],
            pagination: {
              page: input.page,
              limit: input.limit,
              total: 0,
              totalPages: 0,
            },
          };
        }

        filters.minecraftUuid = { $in: uuidsWithViolations };
      }

      const [players, total] = await Promise.all([
        playerService.core.getAll(filters, {
          orderBy: input.orderBy,
          orderDirection: input.orderDirection,
          limit: input.limit,
          offset: input.page * input.limit,
        }),
        playerService.core.count(filters),
      ]);

      let enrichedPlayers = players as any;

      if (input.includeStrikeCounts || input.includeBanCounts) {
        const playerUuids = players.map((p) => p.minecraftUuid);

        const [strikeCounts, banCounts] = await Promise.all([
          input.includeStrikeCounts
            ? playerService.strikes.getActiveStrikeCounts(playerUuids)
            : Promise.resolve({} as Record<string, number>),
          input.includeBanCounts
            ? playerService.bans.getActiveBanCounts(playerUuids)
            : Promise.resolve({} as Record<string, number>),
        ]);

        enrichedPlayers = players.map((player) => ({
          ...player,
          ...(input.includeStrikeCounts && {
            activeStrikeCount: strikeCounts[player.minecraftUuid] ?? 0,
          }),
          ...(input.includeBanCounts && {
            activeBanCount: banCounts[player.minecraftUuid] ?? 0,
          }),
        }));
      }

      return {
        players: enrichedPlayers,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  get: adminProcedure
    .meta({
      description:
        "Get comprehensive player details including balance, playtime, tickets, waitlist, strikes, and bans.",
    })
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);
      const playerData = await playerService.getComprehensive(identifier);

      return {
        player: {
          ...playerData.player,
          createdAt: playerData.player.createdAt.toISOString(),
          updatedAt: playerData.player.updatedAt.toISOString(),
          lastSeen: playerData.player.lastSeen.toISOString(),
        },
        balance: playerData.balance
          ? {
              minecraftUuid: playerData.balance.minecraftUuid,
              balance: BalanceUtils.fromStorage(
                playerData.balance.balance,
              ).toString(),
              updatedAt: playerData.balance.updatedAt.toISOString(),
            }
          : null,
        playtime: {
          summary: playerData.playtime.summary.map((s) => ({
            playerMinecraftUuid: s.playerMinecraftUuid,
            serverId: s.serverId,
            totalSeconds: s.totalSeconds.toString(),
            totalSessions: s.totalSessions,
            avgSessionSeconds: s.avgSessionSeconds?.toString() || "0",
            firstSeen: s.firstSeen?.toISOString() || null,
            lastSeen: s.lastSeen?.toISOString() || null,
            updatedAt: s.updatedAt.toISOString(),
          })),
          totalSeconds: playerData.playtime.totalSeconds,
          totalSessions: playerData.playtime.totalSessions,
        },
        tickets: playerData.tickets,
        waitlist: playerData.waitlist
          ? {
              ...playerData.waitlist,
              submittedAt: playerData.waitlist.submittedAt.toISOString(),
              acceptedAt:
                playerData.waitlist.acceptedAt?.toISOString() || null,
            }
          : null,
        strikes: {
          all: playerData.strikes.all.map((s) => ({
            ...s,
            issuedAt: s.issuedAt.toISOString(),
            removedAt: s.removedAt?.toISOString() || null,
          })),
          active: playerData.strikes.active.map((s) => ({
            ...s,
            issuedAt: s.issuedAt.toISOString(),
            removedAt: s.removedAt?.toISOString() || null,
          })),
          activeCount: playerData.strikes.activeCount,
          totalCount: playerData.strikes.totalCount,
        },
        bans: playerData.bans,
      };
    }),

  update: adminProcedure
    .meta({ description: "Update a player's Minecraft username or Discord ID." })
    .input(
      z.object({
        id: z.string().min(1),
        minecraftUsername: z.string().optional(),
        discordId: z.string().optional(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);

      if (!input.minecraftUsername && !input.discordId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one field to update is required",
        });
      }

      const updates: any = {};
      if (input.minecraftUsername)
        updates.minecraftUsername = input.minecraftUsername;
      if (input.discordId) updates.discordId = input.discordId;

      const updatedPlayer = await playerService.core.adminUpdate(
        identifier,
        updates,
        ctx.user.discordId,
        ctx.user.username,
        input.reason,
      );

      return { player: updatedPlayer };
    }),

  delete: adminProcedure
    .meta({ description: "Permanently delete a player and all associated data." })
    .input(
      z.object({
        id: z.string().min(1),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);

      await playerService.core.adminDelete(
        identifier,
        ctx.user.discordId,
        ctx.user.username,
        input.reason,
      );

      return { message: "Player deleted successfully" };
    }),
});
