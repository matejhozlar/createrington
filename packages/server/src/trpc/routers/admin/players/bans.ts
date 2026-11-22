import { z } from "zod";
import { router, adminProcedure } from "@/trpc/trpc";
import { Q, playerBanRepo } from "@/db";
import { playerBanService } from "@/services/player/ban";
import {
  ADMIN_REASON_MAX_LENGTH,
  BAN_REASON_MAX_LENGTH,
} from "@createrington/shared/admin-reason";
import { id, playerId } from "@/trpc/utils";

const banMetadata = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional();

export const bansRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get all bans for a player with statistics and current ban status",
    })
    .input(
      z.object({
        id: playerId(),
        includeUnbanned: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const [bans, statistics, currentBan] = await Promise.all([
        playerBanRepo.getHistory(input.id, {
          includeUnbanned: input.includeUnbanned,
        }),
        playerBanRepo.getStatistics(input.id),
        playerBanRepo.findCurrent(input.id),
      ]);

      return { bans, statistics, current: currentBan };
    }),

  issueTemporary: adminProcedure
    .meta({
      description:
        "Issue a temporary ban. Bans on all Minecraft servers via RCON and sends a Discord notification",
    })
    .input(
      z.object({
        id: playerId(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(BAN_REASON_MAX_LENGTH),
        durationDays: z.number().int().min(1).max(365),
        serverId: id().optional(),
        metadata: banMetadata,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id: identifier, ...details } = input;
      const ban = await playerBanService.issueTemporary(
        identifier,
        details,
        ctx.user,
      );
      return { ban };
    }),

  issuePermanent: adminProcedure
    .meta({
      description:
        "Issue a permanent ban. Removes whitelist, bans on all servers, kicks from Discord, and sends a notification",
    })
    .input(
      z.object({
        id: playerId(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(BAN_REASON_MAX_LENGTH),
        serverId: id().optional(),
        metadata: banMetadata,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id: identifier, ...details } = input;
      const ban = await playerBanService.issuePermanent(
        identifier,
        details,
        ctx.user,
      );
      return { banId: ban.id };
    }),

  unban: adminProcedure
    .meta({
      description:
        "Unban/pardon a player. Pardons on all Minecraft servers via RCON and sends a Discord notification",
    })
    .input(
      z.object({
        banId: id(),
        reason: z
          .string()
          .min(1, "Reason is required")
          .max(ADMIN_REASON_MAX_LENGTH),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const ban = await playerBanService.unban(
        input.banId,
        input.reason,
        ctx.user,
      );
      return { ban };
    }),

  listRecent: adminProcedure
    .meta({
      description:
        "Get recent bans across all players. Defaults to active-only",
    })
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        activeOnly: z.boolean().default(true),
      }),
    )
    .query(async ({ input }) => {
      const bans = await Q.player.ban.getRecent(input.limit, input.activeOnly);

      return { bans };
    }),
});
