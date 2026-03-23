import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerService } from "@/services/player";
import { Q } from "@/db";
import { escapeLike } from "@/db/utils";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import {
  parsePlayerId,
  paginationInput,
  buildPagination,
  trpcError,
} from "@/trpc/utils";
import type { Player, PlayerFilters } from "@createrington/shared/db";

/** Admin players CRUD router — stats, list, get, update, and delete players. */
export const playersRouter = router({
  stats: adminProcedure
    .meta({
      description: "Get overall player statistics for the admin dashboard.",
    })
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
        ...paginationInput(),
        orderBy: z
          .enum(["createdAt", "minecraftUsername", "updatedAt", "lastSeen"])
          .default("createdAt"),
        orderDirection: z.enum(["asc", "desc"]).default("desc"),
        includeStrikeCounts: z.boolean().default(false),
        includeBanCounts: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const filters: PlayerFilters = {};

      if (input.discordId) filters.discordId = input.discordId;
      if (input.minecraftUuid) filters.minecraftUuid = input.minecraftUuid;
      if (input.minecraftUsername) {
        filters.minecraftUsername = {
          $ilike: `%${escapeLike(input.minecraftUsername)}%`,
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
            pagination: buildPagination(input.page, input.limit, 0),
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

      let enrichedPlayers: (Player & {
        activeStrikeCount?: number;
        activeBanCount?: number;
      })[] = players;

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
        pagination: buildPagination(input.page, input.limit, total),
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
        player: playerData.player,
        balance: playerData.balance
          ? {
              minecraftUuid: playerData.balance.minecraftUuid,
              balance: BalanceUtils.fromStorage(
                playerData.balance.balance,
              ).toString(),
              updatedAt: playerData.balance.updatedAt,
            }
          : null,
        playtime: {
          summary: playerData.playtime.summary.map((s) => ({
            ...s,
            totalSeconds: s.totalSeconds.toString(),
            avgSessionSeconds: s.avgSessionSeconds?.toString() || "0",
          })),
          totalSeconds: playerData.playtime.totalSeconds,
          totalSessions: playerData.playtime.totalSessions,
        },
        tickets: playerData.tickets,
        waitlist: playerData.waitlist,
        strikes: playerData.strikes,
        bans: playerData.bans,
      };
    }),

  update: adminProcedure
    .meta({
      description: "Update a player's Minecraft username or Discord ID.",
    })
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
        throw trpcError.badRequest("At least one field to update is required");
      }

      const updates: { minecraftUsername?: string; discordId?: string } = {};
      if (input.minecraftUsername)
        updates.minecraftUsername = input.minecraftUsername;
      if (input.discordId) updates.discordId = input.discordId;

      const updatedPlayer = await playerService.core.adminUpdate(
        identifier,
        updates,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      return { player: updatedPlayer };
    }),

  delete: adminProcedure
    .meta({
      description: "Permanently delete a player and all associated data.",
    })
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
        ctx.user.minecraftUsername,
        input.reason,
      );

      return { message: "Player deleted successfully" };
    }),
});
