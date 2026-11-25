import { db, Q, playerBanRepo } from "@/db";
import { SYSTEM_AUDIT_ACTOR } from "@/db/queries/admin/log/action";
import { DatabaseTable } from "@/generated/db";
import type { PlayerIdObject } from "@/utils/player-identifier";
import { ServiceUnavailableError } from "@/errors";
import { minecraftRcon, WhitelistAction } from "@/utils/rcon";
import { Discord } from "@/discord/constants";
import { EmbedPresets } from "@/discord/embeds";
import type { DiscordEmbedBuilder } from "@/discord/embeds/embed-builder";
import { fetchGuildMember } from "@/discord/utils/fetch-guild-member";
import { playerDeletionService } from "@/services/player/deletion";
import { sessionService } from "@/services/auth/session/session.service";
import { launcherSessionService } from "@/services/auth/launcher/launcher-session.service";
import { BAN_REASON_MAX_LENGTH } from "@createrington/shared/admin-reason";
import type { PlayerBan } from "@createrington/shared/db";

export interface BanActor {
  discordId: string;
  minecraftUsername: string;
}

export interface BanDetails {
  reason: string;
  serverId?: number;
  metadata?: Record<string, unknown>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function inGameBanReason(
  reason: string,
  expiresAt: Date | null,
): string {
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
        throw new ServiceUnavailableError(
          `The in-game ${action} failed on the Minecraft server, so nothing was changed. Try again once the server is reachable.`,
        );
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

/**
 * Owns the ban lifecycle beyond the DB rows: issuing temporary and permanent
 * bans and lifting them, each applied on every Minecraft server via RCON
 * inside the DB transaction (a failed RCON step rolls the record back, a
 * failed commit undoes the RCON step), followed by session revocation,
 * Discord kick and an admin notification as needed. Also auto-unbans expired
 * temporary bans on a 5-minute interval driven by `initialize()` / `shutdown()`;
 * the ban methods do not depend on that lifecycle. Singleton, also registered
 * in the container for the interval.
 */
export class PlayerBanService {
  private unbanCheckInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000;

  /** Temporary ban: bans in game, records it, revokes web and launcher sessions, notifies admins. */
  async issueTemporary(
    identifier: PlayerIdObject,
    details: BanDetails & { durationDays: number },
    actor: BanActor,
  ): Promise<PlayerBan> {
    const expiresAt = new Date(Date.now() + details.durationDays * DAY_MS);
    const player = await Q.player.get(identifier);

    const ban = await recordWithInGame(
      "ban",
      {
        apply: () =>
          minecraftRcon.banAll(
            player.minecraftUsername,
            inGameBanReason(details.reason, expiresAt),
          ),
        undo: () => minecraftRcon.pardonAll(player.minecraftUsername),
      },
      (applyInGame) =>
        db.inTransaction(async (tx) => {
          const issued = await playerBanRepo.issueTemporary(
            identifier,
            {
              reason: details.reason,
              expiresAt,
              serverId: details.serverId,
              metadata: details.metadata,
            },
            actor.discordId,
            actor.minecraftUsername,
            { tx },
          );
          await applyInGame();
          return issued;
        }),
    );
    logger.info(`Banned ${player.minecraftUsername} on all Minecraft servers`);

    await sessionService.revokeAllForUser(player.discordId);
    await launcherSessionService.revokeAllForPlayer(player.minecraftUuid);

    await this.notify(
      EmbedPresets.bans.temporary({
        minecraftUsername: player.minecraftUsername,
        reason: details.reason,
        bannedByDiscordId: actor.discordId,
        durationDays: details.durationDays,
        expiresAt,
      }),
    );

    return ban;
  }

  /** Permanent ban: removes the whitelist entry, bans in game, deletes the player with the ban recorded, kicks from Discord, notifies admins. */
  async issuePermanent(
    identifier: PlayerIdObject,
    details: BanDetails,
    actor: BanActor,
  ): Promise<PlayerBan> {
    const player = await Q.player.get(identifier);

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
            inGameBanReason(details.reason, null),
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
        playerDeletionService.delete(identifier, {
          actor: {
            type: "admin",
            discordId: actor.discordId,
            username: actor.minecraftUsername,
          },
          reason: details.reason,
          writeAudit: false,
          removeFromWhitelist: false,
          serverId: details.serverId,
          beforeDelete: async (tx, deletedPlayer) => {
            ban = await playerBanRepo.createPermanent(
              deletedPlayer,
              details,
              actor.discordId,
              actor.minecraftUsername,
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
        await member.kick(`Permanently banned: ${details.reason}`);
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

    await this.notify(
      EmbedPresets.bans.permanent({
        minecraftUsername: player.minecraftUsername,
        discordId: player.discordId,
        discordTag,
        reason: details.reason,
        bannedByDiscordId: actor.discordId,
      }),
    );

    return ban;
  }

  /** Lifts a ban: pardons in game, records the unban, notifies admins. */
  async unban(
    banId: number,
    reason: string,
    actor: BanActor,
  ): Promise<PlayerBan> {
    const existingBan = await Q.player.ban.get({ id: banId });

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
            banId,
            actor.discordId,
            actor.minecraftUsername,
            reason,
            { tx },
          );
          await applyInGame();
          return lifted;
        }),
    );
    logger.info(`Pardoned ${minecraftUsername} on all Minecraft servers`);

    await this.notify(
      EmbedPresets.bans.unbanned({
        minecraftUsername,
        unbannedByDiscordId: actor.discordId,
        reason,
        originalReason: existingBan.reason,
      }),
    );

    return ban;
  }

  /** Runs an immediate expired-ban sweep, then arms the 5-minute interval. */
  async initialize(): Promise<void> {
    await this.checkExpiredBans();

    this.unbanCheckInterval = setInterval(() => {
      this.checkExpiredBans().catch((error) => {
        logger.error("Failed to check expired bans:", error);
      });
    }, this.CHECK_INTERVAL);

    logger.info(
      "PlayerBanService initialized with auto-unban checker (checks every 5 minutes)",
    );
  }

  private async checkExpiredBans(): Promise<void> {
    try {
      const expiredBans = await Q.player.ban.getExpiredBans();

      if (expiredBans.length === 0) {
        return;
      }

      logger.info(`Found ${expiredBans.length} expired ban(s) to process`);

      for (const ban of expiredBans) {
        try {
          await this.processExpiredBan(ban);
        } catch (error) {
          logger.error(`Failed to auto-unban expired ban #${ban.id}:`, error);
        }
      }

      logger.info(`Processed ${expiredBans.length} expired ban(s)`);
    } catch (error) {
      logger.error("Failed to check for expired bans:", error);
      throw error;
    }
  }

  private async processExpiredBan(ban: PlayerBan): Promise<void> {
    const { minecraftUsername } = await Q.player.get({
      minecraftUuid: ban.playerMinecraftUuid,
    });

    const updatedBan = await Q.player.ban.updateAndReturn(
      { id: ban.id },
      {
        unbanned: true,
        unbannedByDiscordId: SYSTEM_AUDIT_ACTOR.discordId,
        unbannedByUsername: SYSTEM_AUDIT_ACTOR.username,
        unbannedAt: new Date(),
        unbanReason: "Temporary ban expired",
      },
    );

    await Q.admin.log.action.create({
      adminDiscordId: SYSTEM_AUDIT_ACTOR.discordId,
      adminUsername: SYSTEM_AUDIT_ACTOR.username,
      actionType: "unban_player",
      targetPlayerUuid: ban.playerMinecraftUuid,
      targetPlayerName: minecraftUsername,
      tableName: DatabaseTable.PLAYER_BAN.TABLE,
      fieldName: "unbanned",
      oldValue: "false",
      newValue: "true",
      reason: "Temporary ban expired",
      serverId: ban.serverId || undefined,
      metadata: {
        banId: ban.id,
        originalBanType: ban.banType,
        originalReason: ban.reason,
        automatic: true,
      },
    });

    try {
      await minecraftRcon.pardonAll(minecraftUsername);
      logger.info(
        `Auto-pardoned ${minecraftUsername} on all Minecraft servers (ban #${ban.id})`,
      );
    } catch (error) {
      logger.error(
        `Failed to pardon ${minecraftUsername} on Minecraft servers:`,
        error,
      );
    }

    await this.notify(
      EmbedPresets.bans.autoUnbanned({
        minecraftUsername,
        originalReason: updatedBan.reason,
        bannedAt: updatedBan.bannedAt,
        expiresAt: updatedBan.expiresAt!,
      }),
    );

    logger.info(`Auto-unbanned ban #${ban.id} for ${minecraftUsername}`);
  }

  private async notify(embed: DiscordEmbedBuilder): Promise<void> {
    try {
      await Discord.Messages.send({
        channelId: Discord.Channels.administration.NOTIFICATIONS,
        embeds: embed.build(),
      });
    } catch (error) {
      logger.error("Failed to send ban notification to Discord:", error);
    }
  }

  /** Clears the recurring expired-ban interval. Safe to call multiple times. */
  shutdown(): void {
    if (this.unbanCheckInterval) {
      clearInterval(this.unbanCheckInterval);
      this.unbanCheckInterval = null;
    }
    logger.info("PlayerBanService shutdown");
  }
}

export const playerBanService = new PlayerBanService();
