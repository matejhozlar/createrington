import type { Pool, PoolClient } from "pg";
import { DiscordGuildMemberJoinBaseQueries } from "@/generated/db/discord_guild_member_join.queries";

/**
 * Custom queries for discord_guild_member_join table
 *
 * Extends the auto-generated base class with custom methods
 */
export class DiscordGuildMemberJoinQueries extends DiscordGuildMemberJoinBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here

  /**
   * Records a new member join and returns their join number
   *
   * If the user already exists, returns their existing join number
   * This handles cases where a user leaves and rejoins
   *
   * @param userId - Discord user ID
   * @param username - Discord username
   * @returns The user's join number
   */
  async recordJoin(userId: string, username: string): Promise<number> {
    {
      const query = `
            INSERT INTO ${this.table} (user_id, username, joined_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id)
            DO NOTHING
            RETURNING join_number`;

      try {
        const result = await this.db.query<{ join_number: number }>(query, [
          userId,
          username,
        ]);

        if (result.rows.length === 0) {
          const existing = await this.find({ userId });
          if (!existing) {
            throw new Error("Failed to record join - no result returned");
          }
          return existing.joinNumber;
        }

        return result.rows[0].join_number;
      } catch (error) {
        logger.error("Failed to record member join:", error);
        throw error;
      }
    }
  }
}
