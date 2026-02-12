import { db, Q } from "@/db";
import { DatabaseTable } from "@/generated/db";
import type {
  PlayerStrike,
  StrikeClassification,
} from "@createrington/shared/db";
import type { StrikeStatistics } from "@/db/queries/player/strike";
import { BasePlayerRepository, type PlayerIdentifier } from "../base";

/**
 * Repository for player strike management
 *
 * Handles:
 * - Issuing strikes
 * - Removing/pardoning strikes
 * - Strike history and statistics
 * - Active strike tracking
 */
export class PlayerStrikeRepository extends BasePlayerRepository {
  constructor() {
    super();
  }

  /**
   * Issue a strike to a player
   *
   * @param identifier - Player to issue strike to
   * @param data - Strike details
   * @param adminDiscordId - Admin issuing the strike
   * @param adminUsername - Admin username
   * @returns Promise resolving to created strike record
   */
  async issue(
    identifier: PlayerIdentifier,
    data: {
      classification: StrikeClassification;
      description: string;
      severity: 1 | 2 | 3 | 4 | 5;
      serverId?: number;
      metadata?: Record<string, any>;
    },
    adminDiscordId: string,
    adminUsername: string,
  ): Promise<PlayerStrike> {
    const uuid = await this.resolvePlayerUuid(identifier);
    const player = await Q.player.get({ minecraftUuid: uuid });

    return await db.inTransaction(async (tx) => {
      const strike = await tx.player.strike.createAndReturn({
        playerMinecraftUuid: uuid,
        classification: data.classification,
        description: data.description,
        severity: data.severity,
        issuedByDiscordId: adminDiscordId,
        issuedByUsername: adminUsername,
        serverId: data.serverId,
        metadata: data.metadata || {},
      });

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "strike_issued",
        targetPlayerUuid: uuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_STRIKE.TABLE,
        fieldName: DatabaseTable.PLAYER_STRIKE.FIELDS.CLASSIFICATION,
        oldValue: null,
        newValue: data.classification,
        reason: data.description,
        serverId: data.serverId,
        metadata: {
          strikeId: strike.id,
          severity: data.severity,
        },
      });

      logger.info(
        `Strike #${strike.id} issued to ${player.minecraftUsername} (${uuid}) by ${adminUsername}: ${data.classification}`,
      );

      return strike;
    });
  }

  /**
   * Remove/pardon a strike
   *
   * @param strikeId - Strike ID to remove
   * @param adminDiscordId - Admin removing the strike
   * @param adminUsername - Admin username
   * @param reason - Reason for removal
   * @returns Promise resolving to updated strike record
   */
  async remove(
    strikeId: number,
    adminDiscordId: string,
    adminUsername: string,
    reason: string,
  ): Promise<PlayerStrike> {
    const strike = await Q.player.strike.get({ id: strikeId });

    if (strike.removed) {
      throw new Error(`Strike #${strikeId} has already been removed`);
    }

    const player = await Q.player.get({
      minecraftUuid: strike.playerMinecraftUuid,
    });

    return await db.inTransaction(async (tx) => {
      const updatedStrike = await tx.player.strike.updateAndReturn(
        { id: strikeId },
        {
          removed: true,
          removedByDiscordId: adminDiscordId,
          removedByUsername: adminUsername,
          removedAt: new Date(),
          removalReason: reason,
        },
      );

      await tx.admin.log.action.create({
        adminDiscordId,
        adminUsername,
        actionType: "strike_removed",
        targetPlayerUuid: strike.playerMinecraftUuid,
        targetPlayerName: player.minecraftUsername,
        tableName: DatabaseTable.PLAYER_STRIKE.TABLE,
        fieldName: DatabaseTable.PLAYER_STRIKE.FIELDS.REMOVED,
        oldValue: "false",
        newValue: "true",
        reason,
        serverId: strike.serverId || undefined,
        metadata: {
          strikeId,
          originalClassification: strike.classification,
          originalSeverity: strike.severity,
        },
      });

      logger.info(
        `Strike #${strikeId} removed for ${player.minecraftUsername} by ${adminUsername}: ${reason}`,
      );

      return updatedStrike;
    });
  }

  /**
   * Get all strikes for a player
   *
   * @param identifier - Player identifier
   * @param activeOnly - Whether to include only active strikes
   * @returns Promise resolving to an array of player strikes
   */
  async getHistory(
    identifier: PlayerIdentifier,
    activeOnly: boolean = false,
  ): Promise<PlayerStrike[]> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.strike.getStrikeHistory(uuid, !activeOnly);
  }

  /**
   * Gets all strikes for a player
   *
   * @param identifier - Player identifier
   * @param activeOnly - Whether to include only active strikes
   * @returns Promise resolving to an array of player strikes
   */
  async get(
    identifier: PlayerIdentifier,
    activeOnly: boolean = false,
  ): Promise<PlayerStrike[]> {
    return this.getHistory(identifier, activeOnly);
  }

  /**
   * Get active strike counts for multiple players efficiently
   *
   * @param playerUuids - Array of player UUIDs
   * @returns Promise resolving to a map of UUID -> active strike count
   */
  async getActiveStrikeCounts(
    playerUuids: string[],
  ): Promise<Record<string, number>> {
    return await Q.player.strike.getActiveStrikeCounts(playerUuids);
  }

  /**
   * Get strike statistics for a player
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to strike statistics
   */
  async getStatistics(identifier: PlayerIdentifier): Promise<StrikeStatistics> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.strike.getPlayerStatistics(uuid);
  }

  /**
   * Count active strikes for a player
   *
   * @param identifier - Player identifier
   * @returns Promise resolving to a number of strikes
   */
  async countActive(identifier: PlayerIdentifier): Promise<number> {
    const uuid = await this.resolvePlayerUuid(identifier);
    return await Q.player.strike.countActiveStrikes(uuid);
  }
}
