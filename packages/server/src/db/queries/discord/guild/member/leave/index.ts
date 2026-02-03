import type { Pool, PoolClient } from "pg";
import { DiscordGuildMemberLeaveBaseQueries } from "@/generated/db/discord_guild_member_leave.queries";

/**
 * Custom queries for discord_guild_member_leave table
 *
 * Extends the auto-generated base class with custom methods
 */
export class DiscordGuildMemberLeaveQueries extends DiscordGuildMemberLeaveBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Finds all members who departed more than 30 days ago
   * and haven't been deleted
   *
   * @returns Promise resolving to an Array of departed members
   */
  async expired(): Promise<
    Array<{
      id: number;
      discordId: string;
      minecraftUuid: string;
      minecraftUsername: string;
      notificationMessageId: string | null;
      departedAt: Date;
    }>
  > {
    const query = `
    SELECT id, discord_id, minecraft_uuid, minecraft_username, notification_message_id, departed_at
    FROM ${this.table}
    WHERE departed_at < NOW() - INTERVAL '30 days'
      AND deleted_at IS NULL`;

    try {
      const result = await this.db.query(query);
      return result.rows.flatMap((row) => this.mapRowsToEntities(row));
    } catch (error) {
      console.error("Error fetching expired members:", error);
      throw error;
    }
  }
}
