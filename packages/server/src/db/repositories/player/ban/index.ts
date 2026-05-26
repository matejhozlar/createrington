import { db, Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { PlayerBan, BanType } from "@createrington/shared/db";
import { AdminEdit } from "@/types";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";
import type { BanStatistics } from "@/db/queries/player/ban";

/**
 * Player ban lifecycle: issuing temporary or permanent bans, unbanning,
 * querying history and statistics, and sweeping expired temporary bans.
 * Every mutation writes a paired admin_log_action entry inside the same DB
 * transaction. Permanent bans cascade-delete the player row.
 */
export class PlayerBanRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Issue a temporary ban that expires at the given timestamp. Rejects if the
   * player already has an active ban or if expiresAt is not in the future.
   */
  async issueTemporary(
    identifier: PlayerIdentifier,
    data: {
      reason: string;
      expiresAt: Date;
      serverId?: number;
      metadata?: Record<string, unknown>;
    },
    adminDiscordId: string,
    adminUsername: string,
  ): Promise<PlayerBan> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    if (data.expiresAt <= new Date()) {
      throw new Error("Ban expiry must be in the future");
    }

    const existingBan = await Q.player.ban.getCurrentBan(uuid);
    if (existingBan) {
      throw new Error(
        `Player is already banned (Ban #${existingBan.id}, expires: ${existingBan.expiresAt ? existingBan.expiresAt.toISOString() : "permanent"})`,
      );
    }

    return await db.inTransaction(async (tx) => {
      const ban = await tx.player.ban.createAndReturn({
        playerMinecraftUuid: uuid,
        banType: "temporary" as BanType,
        reason: data.reason,
        bannedByDiscordId: adminDiscordId,
        bannedByUsername: adminUsername,
        expiresAt: data.expiresAt,
        serverId: data.serverId,
        metadata: data.metadata || {},
      });

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: AdminEdit.BAN_PLAYER_TEMPORARY,
        targetPlayerUuid: uuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_BAN.TABLE,
        fieldName: DatabaseTable.PLAYER_BAN.FIELDS.BAN_TYPE,
        oldValue: null,
        newValue: "temporary",
        reason: data.reason,
        serverId: data.serverId,
        metadata: {
          banId: ban.id,
          expiresAt: data.expiresAt.toISOString(),
        },
      });

      logger.info(
        `Temporary ban #${ban.id} issued to ${player.minecraftUsername} (${uuid}) by ${adminUsername}, expires: ${data.expiresAt.toISOString()}`,
      );

      return ban;
    });
  }

  /**
   * Issue a permanent ban and hard-delete the player. The returned ban row is
   * a snapshot from before the cascade and cannot be re-fetched afterward.
   * Irreversible.
   */
  async issuePermanent(
    identifier: PlayerIdentifier,
    data: {
      reason: string;
      serverId?: number;
      metadata?: Record<string, unknown>;
    },
    adminDiscordId: string,
    adminUsername: string,
  ): Promise<PlayerBan> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    const existingBan = await Q.player.ban.getCurrentBan(uuid);
    if (existingBan) {
      throw new Error(
        `Player is already banned (Ban #${existingBan.id}). Use unban first if you want to change ban type.`,
      );
    }

    return await db.inTransaction(async (tx) => {
      // Create ban record first (will be deleted with player due to CASCADE)
      const ban = await tx.player.ban.createAndReturn({
        playerMinecraftUuid: uuid,
        banType: "permanent" as BanType,
        reason: data.reason,
        bannedByDiscordId: adminDiscordId,
        bannedByUsername: adminUsername,
        expiresAt: null, // Permanent bans don't expire
        serverId: data.serverId,
        metadata: data.metadata || {},
      });

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: AdminEdit.BAN_PLAYER_PERMANENT,
        targetPlayerUuid: uuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_BAN.TABLE,
        fieldName: DatabaseTable.PLAYER_BAN.FIELDS.BAN_TYPE,
        oldValue: null,
        newValue: "permanent",
        reason: data.reason,
        serverId: data.serverId,
        metadata: {
          banId: ban.id,
          discordId: player.discordId,
          minecraftUsername: player.minecraftUsername,
        },
      });

      // Delete the player - cascades to all related data including the ban record
      await tx.player.delete({ minecraftUuid: uuid });

      logger.warn(
        `PERMANENT BAN: Player ${player.minecraftUsername} (${uuid}) permanently banned and deleted by ${adminUsername}. Reason: ${data.reason}`,
      );

      return ban;
    });
  }

  /**
   * Lift a ban by ID. Works for both ban types, but permanent bans that
   * already cascade-deleted the player cannot be undone; the player record
   * stays gone.
   */
  async unban(
    banId: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<PlayerBan> {
    const ban = await Q.player.ban.get({ id: banId });

    if (ban.unbanned) {
      throw new Error(`Ban #${banId} has already been lifted`);
    }

    // Try to get player info (will fail if permanent ban already processed)
    let playerName = "Unknown (Deleted)";
    try {
      const player = await Q.player.find({
        minecraftUuid: ban.playerMinecraftUuid,
      });
      if (player) {
        playerName = player.minecraftUsername;
      }
    } catch {
      // Player was deleted due to permanent ban
    }

    return await db.inTransaction(async (tx) => {
      const updatedBan = await tx.player.ban.updateAndReturn(
        { id: banId },
        {
          unbanned: true,
          unbannedByDiscordId: adminDiscordId,
          unbannedByUsername: adminUsername,
          unbannedAt: new Date(),
          unbanReason: reason,
        },
      );

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: AdminEdit.UNBAN_PLAYER,
        targetPlayerUuid: ban.playerMinecraftUuid,
        targetPlayerName: playerName,
        tableName: DatabaseTable.PLAYER_BAN.TABLE,
        fieldName: DatabaseTable.PLAYER_BAN.FIELDS.UNBANNED,
        oldValue: "false",
        newValue: "true",
        reason,
        serverId: ban.serverId || undefined,
        metadata: {
          banId,
          originalBanType: ban.banType,
          originalReason: ban.reason,
        },
      });

      logger.info(
        `Ban #${banId} lifted for ${playerName} by ${adminUsername}: ${reason}`,
      );

      return updatedBan;
    });
  }

  /** True if the player has an active (not unbanned, not expired) ban. */
  async isBanned(identifier: PlayerIdentifier): Promise<boolean> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.isPlayerBanned(uuid);
  }

  /** The player's currently active ban row, or null. */
  async getCurrent(identifier: PlayerIdentifier): Promise<PlayerBan | null> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getCurrentBan(uuid);
  }

  /** Full ban history for a player; pass includeUnbanned=false to skip lifted bans. */
  async getHistory(
    identifier: PlayerIdentifier,
    includeUnbanned: boolean = true,
  ): Promise<PlayerBan[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getBanHistory(uuid, includeUnbanned);
  }

  /** Aggregate ban statistics for a single player. */
  async getStatistics(identifier: PlayerIdentifier): Promise<BanStatistics> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getPlayerStatistics(uuid);
  }

  /** Batched UUID -> active ban count map, for list views. */
  async getActiveBanCounts(
    playerUuids: string[],
  ): Promise<Record<string, number>> {
    return await Q.player.ban.getActiveBanCounts(playerUuids);
  }

  /** All bans of a given type; pass activeOnly=false to include lifted/expired. */
  async getByType(
    banType: BanType,
    activeOnly: boolean = true,
  ): Promise<PlayerBan[]> {
    return await Q.player.ban.getByType(banType, activeOnly);
  }

  /** All bans issued by a specific admin. */
  async getByAdmin(adminDiscordId: string): Promise<PlayerBan[]> {
    return await Q.player.ban.getByAdmin(adminDiscordId);
  }

  /** Recently issued bans across all players. */
  async getRecent(
    limit: number = 50,
    activeOnly: boolean = true,
  ): Promise<PlayerBan[]> {
    return await Q.player.ban.getRecent(limit, activeOnly);
  }

  /** Temporary bans whose expiresAt has passed but are still marked active. */
  async getExpired(): Promise<PlayerBan[]> {
    return await Q.player.ban.getExpiredBans();
  }

  /**
   * Auto-unban every expired temporary ban (designed for periodic cron use).
   * Per-ban failures are logged and skipped so one bad row never aborts the
   * sweep. Returns the count successfully cleaned.
   */
  async cleanupExpired(systemUsername: string = "System"): Promise<number> {
    const expiredBans = await this.getExpired();

    if (expiredBans.length === 0) {
      return 0;
    }

    let cleanedCount = 0;

    for (const ban of expiredBans) {
      try {
        await this.unban(
          ban.id,
          "system",
          systemUsername,
          "Automatic unban - temporary ban expired",
        );
        cleanedCount++;
      } catch (error) {
        logger.error(`Failed to cleanup expired ban #${ban.id}:`, error);
      }
    }

    logger.info(`Cleaned up ${cleanedCount} expired ban(s)`);
    return cleanedCount;
  }
}
