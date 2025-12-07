import { Pool } from "pg";
import { BaseQueries } from "../../base.queries";
import { GuildMemberJoin } from "./types";
import { GuildMemberJoinCreate, GuildMemberJoinRow } from "./types";

type Identifier = { joinNumber: number } | { userId: string };

type Filters = {};

/**
 * Database queries for guild_member_joins table
 *
 * This table tracks the persistent join order or members
 * Each member gets a unique join_number that never changes
 */
export class GuildMemberJoinQueries extends BaseQueries<{
  Entity: GuildMemberJoin;
  DbEntity: GuildMemberJoinRow;
  Identifier: Identifier;
  Filters: Partial<GuildMemberJoin>;
  Update: never;
  Create: GuildMemberJoinCreate;
}> {
  protected readonly table = "guild_member_joins";

  constructor(db: Pool) {
    super(db);
  }

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

  /**
   * Gets a member's join number by their user ID
   * Returns null if they haven't joined before
   *
   * @param userId - Discord user ID
   * @returns Join number or null
   */
  async getJoinNumber(userId: string): Promise<number | null> {
    const member = await this.find({ userId });
    return member?.joinNumber ?? null;
  }
}
