import type { Pool, PoolClient } from "pg";
import { PlayerAchievementBaseQueries } from "@/generated/db/player_achievement.queries";
import type { PlayerAchievement } from "@createrington/shared/db/player_achievement.types";

/**
 * Custom queries for player_achievement table
 *
 * Extends the auto-generated base class with custom methods.
 */
export class PlayerAchievementQueries extends PlayerAchievementBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get all completed achievement rows for a player on a server
   */
  async getCompletedForPlayer(
    playerUuid: string,
    serverId: number,
  ): Promise<PlayerAchievement[]> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE minecraft_uuid = $1 AND server_id = $2
      ORDER BY achievement_group_id, tier`;

    try {
      const result = await this.db.query(query, [playerUuid, serverId]);
      return this.mapRowsToEntities(result.rows);
    } catch (error) {
      logger.error("Failed to get completed achievements:", error);
      throw error;
    }
  }

  /**
   * Get unclaimed completed achievements for a player on a server
   */
  async getUnclaimedForPlayer(
    playerUuid: string,
    serverId: number,
  ): Promise<PlayerAchievement[]> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE minecraft_uuid = $1 AND server_id = $2 AND claimed_at IS NULL
      ORDER BY achievement_group_id, tier`;

    try {
      const result = await this.db.query(query, [playerUuid, serverId]);
      return this.mapRowsToEntities(result.rows);
    } catch (error) {
      logger.error("Failed to get unclaimed achievements:", error);
      throw error;
    }
  }

  /**
   * Batch insert multiple tier completions at once
   */
  async batchComplete(
    playerUuid: string,
    serverId: number,
    entries: {
      achievementGroupId: string;
      tier: number;
      rewardAmount: number;
    }[],
  ): Promise<void> {
    if (entries.length === 0) return;

    const values: unknown[] = [];
    const rows: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      const offset = i * 5;
      rows.push(
        `($${offset + 1}::uuid, $${offset + 2}::integer, $${offset + 3}::text, $${offset + 4}::integer, $${offset + 5}::integer)`,
      );
      values.push(
        playerUuid,
        serverId,
        entries[i].achievementGroupId,
        entries[i].tier,
        entries[i].rewardAmount,
      );
    }

    const query = `
      INSERT INTO ${this.table} (minecraft_uuid, server_id, achievement_group_id, tier, reward_amount)
      VALUES ${rows.join(", ")}
      ON CONFLICT (minecraft_uuid, server_id, achievement_group_id, tier) DO NOTHING`;

    try {
      await this.db.query(query, values);
    } catch (error) {
      logger.error("Failed to batch complete achievements:", error);
      throw error;
    }
  }

  /**
   * Claim a single achievement tier and return the reward amount.
   * Returns null if the row doesn't exist or is already claimed.
   */
  async claimAndReturnReward(
    playerUuid: string,
    serverId: number,
    groupId: string,
    tier: number,
  ): Promise<number | null> {
    const query = `
      UPDATE ${this.table}
      SET claimed_at = NOW()
      WHERE minecraft_uuid = $1
        AND server_id = $2
        AND achievement_group_id = $3
        AND tier = $4
        AND claimed_at IS NULL
      RETURNING reward_amount`;

    try {
      const result = await this.db.query<{ reward_amount: number }>(
        query,
        [playerUuid, serverId, groupId, tier],
      );
      return result.rows[0]?.reward_amount ?? null;
    } catch (error) {
      logger.error("Failed to claim achievement reward:", error);
      throw error;
    }
  }
}
