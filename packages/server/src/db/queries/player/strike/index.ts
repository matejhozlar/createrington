import { Pool, PoolClient } from "pg";
import { PlayerStrikeBaseQueries } from "@/generated/db/player_strike.queries";
import { PlayerStrike } from "@createrington/shared/db";
import { DatabaseTable } from "@/generated/db";

export type StrikeClassification =
  | "pvp"
  | "theft"
  | "griefing"
  | "laggy_machines"
  | "inappropriate_chat"
  | "harassment"
  | "exploiting"
  | "rule_violation"
  | "other";

export interface StrikeStatistics {
  total: number;
  active: number;
  removed: number;
  byClassification: Record<StrikeClassification, number>;
  bySeverity: Record<1 | 2 | 3 | 4 | 5, number>;
  mostRecent?: Date;
}

/**
 * Custom queries for player_strike table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class PlayerStrikeQueries extends PlayerStrikeBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<PlayerStrike[]> {
  //   const result = await this.db.query<PlayerStrike>(
  //     `SELECT * FROM player_strike WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
  /**
   * Get all active (non-removed) strikes for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get all active strikes for
   * @returns Promise resolving to an array of player strikes
   */
  async getActiveStrikes(playerMinecraftUuid: string): Promise<PlayerStrike[]> {
    return await this.findAll(
      {
        playerMinecraftUuid,
        removed: false,
      },
      {
        orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
        orderDirection: "DESC",
      },
    );
  }

  /**
   * Get complete strike history for a player (including removed)
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get all strikes for
   * @param includeRemoved - Whether to include removed strikes (default: true)
   * @returns Promise resolving to an array of player strikes
   */
  async getStrikeHistory(
    playerMinecraftUuid: string,
    includeRemoved: boolean = true,
  ): Promise<PlayerStrike[]> {
    const filters = includeRemoved
      ? { playerMinecraftUuid }
      : { playerMinecraftUuid, removed: false };

    return await this.findAll(filters, {
      orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
      orderDirection: "DESC",
    });
  }

  /**
   * Get strike statistics for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get statistics for
   * @returns Promise resolving strike statistics
   */
  async getPlayerStatistics(
    playerMinecraftUuid: string,
  ): Promise<StrikeStatistics> {
    const allStrikes = await this.findAll({ playerMinecraftUuid });

    const stats: StrikeStatistics = {
      total: allStrikes.length,
      active: 0,
      removed: 0,
      byClassification: {
        pvp: 0,
        theft: 0,
        griefing: 0,
        laggy_machines: 0,
        inappropriate_chat: 0,
        harassment: 0,
        exploiting: 0,
        rule_violation: 0,
        other: 0,
      },
      bySeverity: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };

    for (const strike of allStrikes) {
      if (strike.removed) {
        stats.removed++;
      } else {
        stats.active++;
      }

      stats.byClassification[strike.classification as StrikeClassification]++;
      stats.bySeverity[strike.severity as 1 | 2 | 3 | 4 | 5]++;

      if (!stats.mostRecent || strike.issuedAt > stats.mostRecent) {
        stats.mostRecent = strike.issuedAt;
      }
    }

    return stats;
  }

  /**
   * Count active strikes for a player
   *
   * @param playerMinecraftUuid - Player Minecraft UUID to get count for
   * @returns Promise resolving to the number of active strikes
   */
  async countActiveStrikes(playerMinecraftUuid: string): Promise<number> {
    return await this.count({
      playerMinecraftUuid,
      removed: false,
    });
  }

  /**
   * Get strikes by classification across all players
   *
   * @param classification - The classification to get players for
   * @param activeOnly - Whether to include only active strikes
   * @returns Promise resolving to an array of player strikes
   */
  async getByClassification(
    classification: StrikeClassification,
    activeOnly: boolean = true,
  ): Promise<PlayerStrike[]> {
    const filters = activeOnly
      ? { classification, removed: false }
      : { classification };

    return await this.findAll(filters, {
      orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
      orderDirection: "DESC",
    });
  }

  /**
   * Get all strikes issued by a specific admin
   *
   * @param adminDiscordid - Discord user ID of the admin
   * @returns Promise resolving to an array of player strikes
   */
  async getByAdmin(adminDiscordId: string): Promise<PlayerStrike[]> {
    return await this.findAll(
      { issuedByDiscordId: adminDiscordId },
      {
        orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
        orderDirection: "DESC",
      },
    );
  }

  /**
   * Get recent strikes across all players
   *
   * @param limit - Number of maximum strikes to return
   * @param activeOnly - Whether to include only active strikes
   * @returns Promise resolving to an array of most recent strikes
   */
  async getRecent(
    limit: number = 50,
    activeOnly: boolean = true,
  ): Promise<PlayerStrike[]> {
    const filters = activeOnly ? { removed: false } : undefined;

    return await this.findAll(filters, {
      limit,
      orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
      orderDirection: "DESC",
    });
  }

  /**
   * Get strikes by severity level
   *
   * @param severity - The severity to get strikes by
   * @param activeOnly - Whether to include only active strikes
   */
  async getBySeverity(
    severity: 1 | 2 | 3 | 4 | 5,
    activeOnly: boolean = true,
  ): Promise<PlayerStrike[]> {
    const filters = activeOnly ? { severity, removed: false } : { severity };

    return await this.findAll(filters, {
      orderBy: DatabaseTable.PLAYER_STRIKE.CAMEL_FIELDS.ISSUED_AT,
      orderDirection: "DESC",
    });
  }
}
