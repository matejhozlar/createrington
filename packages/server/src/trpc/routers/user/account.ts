import { z } from "zod";
import { router, userProcedure } from "@/trpc/trpc";
import { trpcError } from "@/trpc/utils";
import { Q } from "@/db";
import { BalanceUtils } from "@/db/repositories/balance/utils";
import { playerDeletionService } from "@/services/player/deletion";
import { getService, Services } from "@/services";
import config from "@/config";

/** User account router: profile info, session management, data export, and account deletion. */
export const accountRouter = router({
  me: userProcedure
    .meta({
      description:
        "Get the authenticated user's account info including linked Minecraft profile and creation date",
    })
    .query(async ({ ctx }) => {
      const player = await Q.player.find({ discordId: ctx.user.discordId });
      if (!player) throw trpcError.notFound("Player not found");

      return {
        discordId: player.discordId,
        discordUsername: ctx.user.username,
        discordAvatar: ctx.user.avatar ?? null,
        minecraftUuid: player.minecraftUuid,
        minecraftUsername: player.minecraftUsername,
        role: ctx.user.role,
        isOwner: ctx.user.discordId === config.app.auth.owner.discordId,
        createdAt: player.createdAt.toISOString(),
      };
    }),

  balance: userProcedure
    .meta({ description: "Get player's current in-game balance" })
    .query(async ({ ctx }) => {
      const balance = await Q.player.balance.find({
        minecraftUuid: ctx.user.minecraftUuid,
      });
      return {
        balance: String(BalanceUtils.fromStorage(balance?.balance ?? 0n)),
      };
    }),

  sessions: userProcedure
    .meta({
      description:
        "List all active (non-revoked, non-expired) sessions for the authenticated user",
    })
    .query(async ({ ctx }) => {
      const sessions = await Q.auth.session.getActiveSessions(
        ctx.user.discordId,
      );

      return sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        createdAt: s.created_at.toISOString(),
        lastUsedAt: s.last_used_at.toISOString(),
        expiresAt: s.expires_at.toISOString(),
      }));
    }),

  revokeSession: userProcedure
    .meta({
      description:
        "Revoke a specific session by ID. Only sessions belonging to the authenticated user can be revoked",
    })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sessions = await Q.auth.session.getActiveSessions(
        ctx.user.discordId,
      );
      const target = sessions.find((s) => s.id === input.id);

      if (!target) {
        throw trpcError.notFound("Session not found");
      }

      await Q.auth.session.revokeById(input.id);
      return { success: true };
    }),

  exportData: userProcedure
    .meta({
      description:
        "Export all personal data as a single JSON object, covering playtime, balance, moderation history, and more",
    })
    .query(async ({ ctx }) => {
      const { discordId, minecraftUuid } = ctx.user;
      const mcFilter = { playerMinecraftUuid: minecraftUuid };
      const mcFilterAlt = { minecraftUuid };

      const [
        playerData,
        sessions,
        balance,
        balanceTransactions,
        gameSessions,
        playtimeDaily,
        playtimeHourly,
        playtimeSummary,
        minecraftStats,
        bans,
        strikes,
        rewardClaims,
        lotteryEntries,
        tickets,
      ] = await Promise.all([
        Q.player.find({ discordId }),
        Q.auth.session.getActiveSessions(discordId),
        Q.player.balance.find(mcFilterAlt).catch(() => null),
        Q.player.balance.transaction.findAll(mcFilter, {
          orderBy: "createdAt",
          orderDirection: "desc",
        }),
        Q.player.session.findAll(mcFilter, {
          orderBy: "sessionStart",
          orderDirection: "desc",
        }),
        Q.player.playtime.daily.findAll(mcFilter, {
          orderBy: "playDate",
          orderDirection: "desc",
        }),
        Q.player.playtime.hourly.findAll(mcFilter, {
          orderBy: "playHour",
          orderDirection: "desc",
        }),
        Q.player.playtime.summary.findAll(mcFilter),
        Q.player.minecraft.stats.findAll(mcFilterAlt),
        Q.player.ban.findAll(mcFilter, {
          orderBy: "bannedAt",
          orderDirection: "desc",
        }),
        Q.player.strike.findAll(mcFilter, {
          orderBy: "issuedAt",
          orderDirection: "desc",
        }),
        Q.reward.claim.findAll(mcFilter, {
          orderBy: "claimedAt",
          orderDirection: "desc",
        }),
        Q.lottery.participant.findAll(mcFilterAlt),
        Q.ticket.findAll(
          { creatorDiscordId: discordId },
          { orderBy: "createdAt", orderDirection: "desc" },
        ),
      ]);

      const data = {
        exportedAt: new Date().toISOString(),
        player: playerData ?? null,
        sessions,
        balance,
        balanceTransactions,
        gameSessions,
        playtime: {
          daily: playtimeDaily,
          hourly: playtimeHourly,
          summary: playtimeSummary,
        },
        minecraftStats,
        moderation: {
          bans,
          strikes,
        },
        rewardClaims,
        lotteryEntries,
        tickets,
      };

      // BigInt values can't be JSON-serialized, convert them to strings
      return JSON.parse(
        JSON.stringify(data, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value,
        ),
      );
    }),

  deleteAccount: userProcedure
    .meta({
      description:
        "Permanently delete the account and all associated data, then kick the user from Discord. Requires typing a confirmation phrase",
    })
    .input(
      z.object({
        confirmation: z.string().refine((v) => v === "DELETE MY ACCOUNT", {
          message: 'You must type "DELETE MY ACCOUNT" to confirm',
        }),
      }),
    )
    .mutation(async ({ ctx }) => {
      const { discordId } = ctx.user;

      const player = await Q.player.find({ discordId });
      if (!player) throw trpcError.notFound("Player not found");

      await playerDeletionService.delete(
        { discordId },
        {
          actor: {
            type: "user",
            discordId,
            username: player.minecraftUsername,
          },
          reason: "Account deleted by user",
          beforeDelete: async (tx) => {
            await tx.ticket.deleteAll({ creatorDiscordId: discordId });
          },
        },
      );

      // Kick from Discord after successful deletion
      try {
        const mainBot = await getService(Services.DISCORD_MAIN_BOT);
        const guild = mainBot.guilds.cache.first();
        if (guild) {
          const member = await guild.members.fetch(discordId).catch(() => null);
          if (member) {
            await member.kick("Account deleted by user");
            logger.info(
              `Kicked ${player.minecraftUsername} from Discord after account deletion`,
            );
          }
        }
      } catch (error) {
        logger.warn(
          `Failed to kick ${player.minecraftUsername} from Discord after account deletion:`,
          error,
        );
      }

      return { success: true };
    }),
});
