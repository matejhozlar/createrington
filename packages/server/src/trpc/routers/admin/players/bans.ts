import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, adminProcedure } from "../../../trpc";
import { playerService } from "@/services/player";
import { Q } from "@/db";
import { getService, Services } from "@/services";
import { Client } from "discord.js";
import { Discord } from "@/discord/constants";
import { EmbedColors, EmbedPresets } from "@/discord/embeds";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import type { PlayerBan } from "@createrington/shared/db";
import { parsePlayerId } from "../../../utils";

export const bansRouter = router({
  list: adminProcedure
    .meta({
      description:
        "Get all bans for a player with statistics and current ban status.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        includeUnbanned: z.boolean().default(false),
      }),
    )
    .query(async ({ input }) => {
      const identifier = parsePlayerId(input.id);

      const [bans, statistics, currentBan] = await Promise.all([
        playerService.bans.getHistory(identifier, input.includeUnbanned),
        playerService.bans.getStatistics(identifier),
        playerService.bans.getCurrent(identifier),
      ]);

      return {
        bans: bans.map((b: PlayerBan) => ({
          ...b,
          bannedAt: b.bannedAt.toISOString(),
          expiresAt: b.expiresAt?.toISOString() || null,
          unbannedAt: b.unbannedAt?.toISOString() || null,
        })),
        statistics,
        current: currentBan
          ? {
              ...currentBan,
              bannedAt: currentBan.bannedAt.toISOString(),
              expiresAt: currentBan.expiresAt?.toISOString() || null,
              unbannedAt: currentBan.unbannedAt?.toISOString() || null,
            }
          : null,
      };
    }),

  issueTemporary: adminProcedure
    .meta({
      description:
        "Issue a temporary ban. Bans on all Minecraft servers via RCON and sends a Discord notification.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        reason: z.string().min(1, "Reason is required"),
        durationDays: z.number().int().min(1).max(365),
        serverId: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);

      const expiresAt = new Date(
        Date.now() + input.durationDays * 24 * 60 * 60 * 1000,
      );

      const ban = await playerService.bans.issueTemporary(
        identifier,
        {
          reason: input.reason,
          expiresAt,
          serverId: input.serverId,
          metadata: input.metadata,
        },
        ctx.user.discordId,
        ctx.user.minecraftUsername,
      );

      const player = await Q.player.get({
        minecraftUuid: ban.playerMinecraftUuid,
      });

      try {
        await minecraftRcon.banAll(
          player.minecraftUsername,
          `${input.reason} (Expires: ${expiresAt.toISOString()})`,
        );
        logger.info(
          `Banned ${player.minecraftUsername} on all Minecraft servers`,
        );
      } catch (error) {
        logger.error(
          `Failed to ban ${player.minecraftUsername} on Minecraft servers:`,
          error,
        );
      }

      try {
        const embed = EmbedPresets.plain({
          title: "\u23F0 Player Temporarily Banned",
          description: [
            `**Player**: ${player.minecraftUsername}`,
            `**Reason**: ${input.reason}`,
            `**Banned by**: <@${ctx.user.discordId}>`,
            `**Duration**: ${input.durationDays} day${input.durationDays !== 1 ? "s" : ""}`,
            `**Expires**: <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
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

      return {
        ban: {
          ...ban,
          bannedAt: ban.bannedAt.toISOString(),
          expiresAt: ban.expiresAt?.toISOString() || null,
          unbannedAt: ban.unbannedAt?.toISOString() || null,
        },
      };
    }),

  issuePermanent: adminProcedure
    .meta({
      description:
        "Issue a permanent ban. Removes whitelist, bans on all servers, kicks from Discord, and sends a notification.",
    })
    .input(
      z.object({
        id: z.string().min(1),
        reason: z.string().min(1, "Reason is required"),
        serverId: z.number().int().positive().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const identifier = parsePlayerId(input.id);

      const player = await Q.player.get(identifier);

      const mainBot = await getService<Client>(Services.DISCORD_MAIN_BOT);
      const guild = mainBot.guilds.cache.first();
      let member;
      let discordTag = "Unknown";

      if (guild) {
        try {
          member = await guild.members.fetch(player.discordId);
          discordTag = member.user.tag;
        } catch (error) {
          logger.warn(
            `Could not fetch Discord member ${player.discordId}:`,
            error,
          );
        }
      }

      const ban = await playerService.bans.issuePermanent(
        identifier,
        {
          reason: input.reason,
          serverId: input.serverId,
          metadata: input.metadata,
        },
        ctx.user.discordId,
        ctx.user.minecraftUsername,
      );

      try {
        await minecraftRcon.whitelistAll(
          WhitelistAction.REMOVE,
          player.minecraftUsername,
        );
        await minecraftRcon.banAll(
          player.minecraftUsername,
          `${input.reason} (PERMANENT)`,
        );
        logger.info(
          `Permanently banned ${player.minecraftUsername} on all Minecraft servers`,
        );
      } catch (error) {
        logger.error(
          `Failed to ban ${player.minecraftUsername} on Minecraft servers:`,
          error,
        );
      }

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
            `**Banned by**: <@${ctx.user.discordId}>`,
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
        "Unban/pardon a player. Pardons on all Minecraft servers via RCON and sends a Discord notification.",
    })
    .input(
      z.object({
        banId: z.number().int().positive(),
        reason: z.string().min(1, "Reason is required"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingBan = await Q.player.ban.get({ id: input.banId });

      let minecraftUsername = "Unknown";
      let wasDeleted = false;

      try {
        const player = await Q.player.find({
          minecraftUuid: existingBan.playerMinecraftUuid,
        });
        if (player) {
          minecraftUsername = player.minecraftUsername;
        }
      } catch {
        minecraftUsername =
          existingBan.metadata?.minecraftUsername || "Unknown (Deleted)";
        wasDeleted = true;
      }

      const ban = await playerService.bans.unban(
        input.banId,
        ctx.user.discordId,
        ctx.user.minecraftUsername,
        input.reason,
      );

      if (!wasDeleted && minecraftUsername !== "Unknown") {
        try {
          await minecraftRcon.pardonAll(minecraftUsername);
          logger.info(
            `Pardoned ${minecraftUsername} on all Minecraft servers`,
          );
        } catch (error) {
          logger.error(
            `Failed to pardon ${minecraftUsername} on Minecraft servers:`,
            error,
          );
        }
      }

      try {
        const embed = EmbedPresets.plain({
          title: "\u2705 Player Unbanned",
          description: [
            `**Player**: ${minecraftUsername}`,
            `**Unbanned by**: <@${ctx.user.discordId}>`,
            `**Reason**: ${input.reason}`,
            `**Original ban reason**: ${existingBan.reason}`,
            wasDeleted
              ? `\n\u26A0\uFE0F *Player data was previously deleted (permanent ban)*`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          color: EmbedColors.Success,
        });

        await Discord.Messages.send({
          channelId: Discord.Channels.administration.NOTIFICATIONS,
          embeds: embed.build(),
        });
      } catch (error) {
        logger.error("Failed to send unban notification:", error);
      }

      return {
        ban: {
          ...ban,
          bannedAt: ban.bannedAt.toISOString(),
          expiresAt: ban.expiresAt?.toISOString() || null,
          unbannedAt: ban.unbannedAt?.toISOString() || null,
        },
      };
    }),

  getRecent: adminProcedure
    .meta({
      description:
        "Get recent bans across all players. Defaults to active-only.",
    })
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        activeOnly: z.boolean().default(true),
      }),
    )
    .query(async ({ input }) => {
      const bans = await playerService.bans.getRecent(
        input.limit,
        input.activeOnly,
      );

      return {
        bans: bans.map((b) => ({
          ...b,
          bannedAt: b.bannedAt.toISOString(),
          expiresAt: b.expiresAt?.toISOString() || null,
          unbannedAt: b.unbannedAt?.toISOString() || null,
        })),
      };
    }),
});
