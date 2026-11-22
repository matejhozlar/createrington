import { userMention } from "discord.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fetchGuildMember } from "@/discord/utils/fetch-guild-member";
import { router, adminProcedure } from "@/trpc/trpc";
import { playerDeletionService } from "@/services/player/deletion";
import { db, Q, playerBanRepo } from "@/db";
import {
  ADMIN_REASON_MAX_LENGTH,
  BAN_REASON_MAX_LENGTH,
} from "@createrington/shared/admin-reason";
import type { PlayerBan } from "@createrington/shared/db";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import { discordTimestamp, formatCount } from "@/utils/format";
import { id, playerId } from "@/trpc/utils";
import { sessionService } from "@/services/auth/session/session.service";
import { launcherSessionService } from "@/services/auth/launcher/launcher-session.service";

function inGameBanReason(reason: string, expiresAt?: Date | null): string {
  const suffix = expiresAt
    ? `(Expires: ${expiresAt.toISOString()})`
    : "(PERMANENT)";
  return `${reason.slice(0, BAN_REASON_MAX_LENGTH)} ${suffix}`;
}

async function recordWithInGame<T>(
  action: string,
  inGame: { apply: () => Promise<unknown>; undo: () => Promise<unknown> },
  record: (applyInGame: () => Promise<void>) => Promise<T>,
): Promise<T> {
  let attempted = false;
  try {
    return await record(async () => {
      attempted = true;
      try {
        await inGame.apply();
      } catch (error) {
        logger.error(`In-game ${action} failed:`, error);
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `The in-game ${action} failed on the Minecraft server, so nothing was changed. Try again once the server is reachable.`,
        });
      }
    });
  } catch (error) {
    if (attempted) {
      await inGame.undo().catch((undoError: unknown) => {
        logger.error(`Failed to roll back the in-game ${action}:`, undoError);
      });
    }
    throw error;
  }
}

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
        metadata: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const expiresAt = new Date(
        Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
      );

      const player = await Q.player.get(input.id);

      const ban = await recordWithInGame(
        "ban",
        {
          apply: () =>
            minecraftRcon.banAll(
              player.minecraftUsername,
              inGameBanReason(input.reason, expiresAt),
            ),
          undo: () => minecraftRcon.pardonAll(player.minecraftUsername),
        },
        (applyInGame) =>
          db.inTransaction(async (tx) => {
            const issued = await playerBanRepo.issueTemporary(
              input.id,
              {
                reason: input.reason,
                expiresAt,
                serverId: input.serverId,
                metadata: input.metadata,
              },
              ctx.user.discordId,
              ctx.user.minecraftUsername,
              { tx },
            );
            await applyInGame();
            return issued;
          }),
      );
      logger.info(
        `Banned ${player.minecraftUsername} on all Minecraft servers`,
      );

      await sessionService.revokeAllForUser(player.discordId);
      await launcherSessionService.revokeAllForPlayer(player.minecraftUuid);

      try {
        const embed = EmbedPresets.plain({
          title: "\u23F0 Player Temporarily Banned",
          description: [
            `**Player**: ${player.minecraftUsername}`,
            `**Reason**: ${input.reason}`,
            `**Banned by**: ${userMention(ctx.user.discordId)}`,
            `**Duration**: ${formatCount(input.durationDays, "day")}`,
            `**Expires**: ${discordTimestamp(expiresAt)}`,
          ].join("\n"),
          color: 0xffa500,
        });

        await Discord.Messages.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.build(),
        });
      } catch (error) {
        logger.error("Failed to send ban notification to Discord:", error);
      }

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
        metadata: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.null()]),
          )
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const player = await Q.player.get(input.id);

      const member = await fetchGuildMember(player.discordId);
      const discordTag = member?.user.tag ?? "Unknown";

      let ban: PlayerBan | undefined;
      await recordWithInGame(
        "ban",
        {
          apply: async () => {
            await minecraftRcon.whitelistAll(
              WhitelistAction.REMOVE,
              player.minecraftUsername,
            );
            await minecraftRcon.banAll(
              player.minecraftUsername,
              inGameBanReason(input.reason, null),
            );
          },
          undo: async () => {
            await minecraftRcon.pardonAll(player.minecraftUsername);
            await minecraftRcon.whitelistAll(
              WhitelistAction.ADD,
              player.minecraftUsername,
            );
          },
        },
        (applyInGame) =>
          playerDeletionService.delete(input.id, {
            actor: {
              type: "admin",
              discordId: ctx.user.discordId,
              username: ctx.user.minecraftUsername,
            },
            reason: input.reason,
            writeAudit: false,
            removeFromWhitelist: false,
            serverId: input.serverId,
            beforeDelete: async (tx, deletedPlayer) => {
              ban = await playerBanRepo.createPermanent(
                deletedPlayer,
                {
                  reason: input.reason,
                  serverId: input.serverId,
                  metadata: input.metadata,
                },
                ctx.user.discordId,
                ctx.user.minecraftUsername,
                { tx },
              );
              await applyInGame();
            },
          }),
      );

      if (!ban) {
        throw new Error("Failed to create permanent ban record");
      }
      logger.info(
        `Permanently banned ${player.minecraftUsername} on all Minecraft servers`,
      );

      if (member) {
        try {
          await member.kick(`Permanently banned: ${input.reason}`);
          logger.info(
            `Kicked ${player.minecraftUsername} (${discordTag}) from Discord`,
          );
        } catch (error) {
          logger.warn(
            `Failed to kick ${player.minecraftUsername} from Discord:`,
            error,
          );
        }
      }

      try {
        const embed = EmbedPresets.plain({
          title: "\uD83D\uDD34 Player Permanently Banned",
          description: [
            `**Player**: ${player.minecraftUsername}`,
            `**Discord**: ${discordTag} (\`${player.discordId}\`)`,
            `**Reason**: ${input.reason}`,
            `**Banned by**: ${userMention(ctx.user.discordId)}`,
            ``,
            `\u26A0\uFE0F **All player data has been permanently deleted**`,
          ].join("\n"),
          color: 0xff0000,
        });

        await Discord.Messages.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.build(),
        });
      } catch (error) {
        logger.error("Failed to send permanent ban notification:", error);
      }

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
      const existingBan = await Q.player.ban.get({ id: input.banId });

      const { minecraftUsername } = await Q.player.get({
        minecraftUuid: existingBan.playerMinecraftUuid,
      });

      const ban = await recordWithInGame(
        "pardon",
        {
          apply: () => minecraftRcon.pardonAll(minecraftUsername),
          undo: () =>
            minecraftRcon.banAll(
              minecraftUsername,
              inGameBanReason(existingBan.reason, existingBan.expiresAt),
            ),
        },
        (applyInGame) =>
          db.inTransaction(async (tx) => {
            const lifted = await playerBanRepo.unban(
              input.banId,
              ctx.user.discordId,
              ctx.user.minecraftUsername,
              input.reason,
              { tx },
            );
            await applyInGame();
            return lifted;
          }),
      );
      logger.info(`Pardoned ${minecraftUsername} on all Minecraft servers`);

      try {
        const embed = EmbedPresets.plain({
          title: "\u2705 Player Unbanned",
          description: [
            `**Player**: ${minecraftUsername}`,
            `**Unbanned by**: ${userMention(ctx.user.discordId)}`,
            `**Reason**: ${input.reason}`,
            `**Original ban reason**: ${existingBan.reason}`,
          ].join("\n"),
          color: EmbedColors.Success,
        });

        await Discord.Messages.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.build(),
        });
      } catch (error) {
        logger.error("Failed to send unban notification:", error);
      }

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
