import { db, Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type { PlayerBan, BanType } from "@createrington/shared/db";
import type { BanStatistics } from "@createrington/shared/api/admin-player.types";
import { AdminEdit } from "@/types";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Repository for player ban management
 *
 * Handles:
 * - Issuing temporary and permanent bans
 * - Unbanning/pardoning players
 * - Ban history and statistics
 * - Active ban checking
 * - Expired ban cleanup
 */
export class PlayerBanRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  // ============================================================================
  // BAN ISSUANCE
  // ============================================================================

  /**
   * Issue a temporary ban to a player
   * Temporary bans expire after a specified duration and only affect Minecraft server access
   *
   * @param identifier - Player to ban
   * @param data - Ban details including expiry
   * @param adminDiscordId - Admin issuing the ban
   * @param adminUsername - Admin username
   * @returns Promise resolving to created ban record
   */
  async issueTemporary(
    identifier: PlayerIdentifier,
    data: {
      reason: string;
      expiresAt: Date;
      serverId?: number;
      metadata?: Record<string, any>;
    },
    adminDiscordId: string,
    adminUsername: string,
  ): Promise<PlayerBan> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    // Validate expiry is in the future
    if (data.expiresAt <= new Date()) {
      throw new Error("Ban expiry must be in the future");
    }

    // Check if player already has an active ban
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
        adminDiscordUsername: adminUsername,
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
   * Issue a permanent ban to a player
   * Permanent bans result in complete player data deletion from database and Discord
   * This is irreversible and should be used with extreme caution
   *
   * @param identifier - Player to ban permanently
   * @param data - Ban details
   * @param adminDiscordId - Admin issuing the ban
   * @param adminUsername - Admin username
   * @returns Promise resolving to created ban record (before deletion)
   */
  async issuePermanent(
    identifier: PlayerIdentifier,
    data: {
      reason: string;
      serverId?: number;
      metadata?: Record<string, any>;
    },
    adminDiscordId: string,
    adminUsername: string,
  ): Promise<PlayerBan> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    // Check if player already has an active ban
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

      // Log the ban action before deletion
      await tx.admin.log.action.create({
        adminDiscordId,
        adminDiscordUsername: adminUsername,
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

  // ============================================================================
  // UNBAN OPERATIONS
  // ============================================================================

  /**
   * Unban/pardon a player
   * Works for both temporary and permanent bans
   * Note: Permanent bans that already resulted in player deletion cannot be undone
   *
   * @param banId - Ban ID to remove
   * @param adminDiscordId - Admin removing the ban
   * @param adminUsername - Admin username
   * @param reason - Reason for unbanning
   * @returns Promise resolving to updated ban record
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
        adminDiscordUsername: adminUsername,
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

  // ============================================================================
  // BAN QUERIES
  // ============================================================================

  /**
   * Check if a player is currently banned
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to true if player has an active ban
   */
  async isBanned(identifier: PlayerIdentifier): Promise<boolean> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.isPlayerBanned(uuid);
  }

  /**
   * Get the current active ban for a player
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to active ban or null
   */
  async getCurrent(identifier: PlayerIdentifier): Promise<PlayerBan | null> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getCurrentBan(uuid);
  }

  /**
   * Get complete ban history for a player
   *
   * @param identifier - Player identifier
   * @param includeUnbanned - Whether to include unbanned entries
   * @returns Promise resolving to array of bans
   */
  async getHistory(
    identifier: PlayerIdentifier,
    includeUnbanned: boolean = true,
  ): Promise<PlayerBan[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getBanHistory(uuid, includeUnbanned);
  }

  /**
   * Get ban statistics for a player
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to ban statistics
   */
  async getStatistics(identifier: PlayerIdentifier): Promise<BanStatistics> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.ban.getPlayerStatistics(uuid);
  }

  /**
   * Get active ban counts for multiple players efficiently
   * Useful for list views
   *
   * @param playerUuids - Array of player UUIDs
   * @returns Promise resolving to map of UUID -> active ban count
   */
  async getActiveBanCounts(
    playerUuids: string[],
  ): Promise<Record<string, number>> {
    return await Q.player.ban.getActiveBanCounts(playerUuids);
  }

  // ============================================================================
  // ADMIN QUERIES
  // ============================================================================

  /**
   * Get all bans by type
   *
   * @param banType - Type of ban to retrieve
   * @param activeOnly - Whether to only include active bans
   * @returns Promise resolving to array of bans
   */
  async getByType(
    banType: BanType,
    activeOnly: boolean = true,
  ): Promise<PlayerBan[]> {
    return await Q.player.ban.getByType(banType, activeOnly);
  }

  /**
   * Get all bans issued by a specific admin
   *
   * @param adminDiscordId - Discord ID of the admin
   * @returns Promise resolving to array of bans
   */
  async getByAdmin(adminDiscordId: string): Promise<PlayerBan[]> {
    return await Q.player.ban.getByAdmin(adminDiscordId);
  }

  /**
   * Get recent bans across all players
   *
   * @param limit - Maximum number of bans to return
   * @param activeOnly - Whether to only include active bans
   * @returns Promise resolving to array of recent bans
   */
  async getRecent(
    limit: number = 50,
    activeOnly: boolean = true,
  ): Promise<PlayerBan[]> {
    return await Q.player.ban.getRecent(limit, activeOnly);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get all expired temporary bans that need cleanup
   * Useful for scheduled jobs
   *
   * @returns Promise resolving to array of expired bans
   */
  async getExpired(): Promise<PlayerBan[]> {
    return await Q.player.ban.getExpiredBans();
  }

  /**
   * Cleanup expired temporary bans
   * Marks them as unbanned automatically
   * Should be run periodically (e.g., via cron job)
   *
   * @param systemUsername - Username for system actions (default: "System")
   * @returns Promise resolving to number of bans cleaned up
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
