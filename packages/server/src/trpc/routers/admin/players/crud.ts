import { z } from "zod";
import { ADMIN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerDeletionService } from "@/services/player/deletion";
import { Q, playerBanRepo, playerRepo, playerStrikeRepo } from "@/db";
import { ilikeContains } from "@/db/utils";
import { BalanceUtils } from "@/db/utils/balance";
import {
  paginationInput,
  paginateQuery,
  sortDirection,
  buildPagination,
  trpcError,
  playerId,
  pageOffset,
} from "@/trpc/utils";
import { discordId, mcUsername } from "@/utils/zod-schemas";
import type { Player, PlayerFilters } from "@createrington/shared/db";
import { violationFilterInput, violationRequirement } from "./violation-filter";

export const playersRouter = router({
  stats: adminProcedure
    .meta({
      description: "Get overall player statistics for the admin dashboard.",
    })
    .query(async () => {
      return await playerRepo.getStats();
    }),

  list: adminProcedure
    .meta({
      description:
        "List players with filtering, pagination, sorting, and optional strike/ban count enrichment",
    })
    .input(
      z.object({
        discordId: z.string().max(32).optional(),
        minecraftUsername: z.string().max(32).optional(),
        online: z.boolean().optional(),
        ...violationFilterInput,
        ...paginationInput(),
        orderBy: z
          .enum(["createdAt", "minecraftUsername", "updatedAt", "lastSeen"])
          .default("createdAt"),
        orderDirection: sortDirection().default("desc"),
        includeStrikeCounts: z.boolean().default(false),
        includeBanCounts: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const filters: PlayerFilters = {};

      if (input.discordId) filters.discordId = ilikeContains(input.discordId);
      if (input.minecraftUuid) filters.minecraftUuid = input.minecraftUuid;
      if (input.minecraftUsername) {
        filters.minecraftUsername = ilikeContains(input.minecraftUsername);
      }
      if (input.online !== undefined) filters.online = input.online;

      const violation = violationRequirement(input);
      if (violation === "none") {
        return {
          items: [],
          pagination: buildPagination(input.page, input.limit, 0),
        };
      }

      const { rows: players, pagination } = violation
        ? await Q.player
            .getWithViolations(filters, violation, {
              limit: input.limit,
              offset: pageOffset(input),
              orderBy: input.orderBy,
              orderDirection: input.orderDirection,
            })
            .then(({ rows, total }) => ({
              rows,
              pagination: buildPagination(input.page, input.limit, total),
            }))
        : await paginateQuery(Q.player, filters, input, {
            orderBy: input.orderBy,
            orderDirection: input.orderDirection,
          });

      let enrichedPlayers: (Player & {
        activeStrikeCount?: number;
        activeBanCount?: number;
      })[] = players;

      if (input.includeStrikeCounts || input.includeBanCounts) {
        const playerUuids = players.map((p) => p.minecraftUuid);

        const [strikeCounts, banCounts] = await Promise.all([
          input.includeStrikeCounts
            ? Q.player.strike.getActiveStrikeCounts(playerUuids)
            : Promise.resolve({} as Record<string, number>),
          input.includeBanCounts
            ? Q.player.ban.getActiveBanCounts(playerUuids)
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

      return { items: enrichedPlayers, pagination };
    }),

  get: adminProcedure
    .meta({
      description:
        "Get comprehensive player details including balance, playtime, tickets, waitlist, strikes, and bans",
    })
    .input(z.object({ id: playerId() }))
    .query(async ({ input }) => {
      const [playerData, strikes, banHistory, currentBan] = await Promise.all([
        playerRepo.getDetailed(input.id),
        playerStrikeRepo.getHistory(input.id),
        playerBanRepo.getHistory(input.id),
        playerBanRepo.findCurrent(input.id),
      ]);
      const activeStrikes = strikes.filter((s) => !s.removed);
      const activeBans = banHistory.filter((b) => !b.unbanned);

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
        strikes: {
          all: strikes,
          active: activeStrikes,
          activeCount: activeStrikes.length,
          totalCount: strikes.length,
        },
        bans: {
          current: currentBan,
          history: banHistory,
          active: activeBans,
          activeCount: activeBans.length,
          totalCount: banHistory.length,
        },
      };
    }),

  update: adminProcedure
    .meta({
      description: "Update a player's Minecraft username or Discord ID.",
    })
    .input(
      z.object({
        id: playerId(),
        minecraftUsername: mcUsername.optional(),
        discordId: discordId.optional(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(ADMIN_REASON_MAX_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.minecraftUsername && !input.discordId) {
        throw trpcError.badRequest("At least one field to update is required");
      }

      const updates: { minecraftUsername?: string; discordId?: string } = {};
      if (input.minecraftUsername)
        updates.minecraftUsername = input.minecraftUsername;
      if (input.discordId) updates.discordId = input.discordId;

      const updatedPlayer = await playerRepo.adminUpdate(
        input.id,
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
        id: playerId(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(ADMIN_REASON_MAX_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await playerDeletionService.delete(input.id, {
        actor: {
          type: "admin",
          discordId: ctx.user.discordId,
          username: ctx.user.minecraftUsername,
        },
        reason: input.reason,
      });
    }),
});
