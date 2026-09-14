import type { Pool, PoolClient } from "pg";
import { PlayerInactivityExemptionBaseQueries } from "@/generated/db/player_inactivity_exemption.queries";

/**
 * Exemption row joined with the exempted player and the creating admin's
 * current Minecraft username. Both creator fields are null once the admin's
 * player record has been deleted.
 */
export interface ExemptionListItem {
  playerMinecraftUuid: string;
  minecraftUsername: string;
  discordId: string;
  lastSeen: Date;
  reason: string | null;
  createdByDiscordId: string | null;
  createdByMinecraftUsername: string | null;
  createdAt: Date;
}

/**
 * Custom queries for player_inactivity_exemption table
 *
 * Players listed here are skipped by the warning and removal phases of the
 * inactivity sweep.
 */
export class PlayerInactivityExemptionQueries extends PlayerInactivityExemptionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Paginated exemptions joined with player data, optionally filtered by a
   * case-insensitive username substring. Newest first.
   */
  async listWithPlayer(params: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ exemptions: ExemptionListItem[]; total: number }> {
    const listParams: Array<string | number> = [params.limit, params.offset];
    const countParams: string[] = [];
    let listSearchClause = "";
    let countSearchClause = "";

    if (params.search) {
      listParams.push(params.search);
      listSearchClause = `WHERE p.minecraft_username ILIKE '%' || $${listParams.length} || '%'`;
      countParams.push(params.search);
      countSearchClause = `WHERE p.minecraft_username ILIKE '%' || $${countParams.length} || '%'`;
    }

    const listQuery = `
      SELECT
        e.player_minecraft_uuid,
        e.reason,
        e.created_by_discord_id,
        e.created_at,
        p.minecraft_username,
        p.discord_id,
        p.last_seen,
        a.minecraft_username AS created_by_minecraft_username
      FROM player_inactivity_exemption e
      INNER JOIN player p ON p.minecraft_uuid = e.player_minecraft_uuid
      LEFT JOIN player a ON a.discord_id = e.created_by_discord_id
      ${listSearchClause}
      ORDER BY e.created_at DESC
      LIMIT $1 OFFSET $2`;

    const countQuery = `
      SELECT COUNT(*)::integer AS total
      FROM player_inactivity_exemption e
      INNER JOIN player p ON p.minecraft_uuid = e.player_minecraft_uuid
      ${countSearchClause}`;

    const [listResult, countResult] = await Promise.all([
      this.runQuery<{
        player_minecraft_uuid: string;
        reason: string | null;
        created_by_discord_id: string | null;
        created_at: Date;
        minecraft_username: string;
        discord_id: string;
        last_seen: Date;
        created_by_minecraft_username: string | null;
      }>("list inactivity exemptions", listQuery, listParams),
      this.runQuery<{ total: number }>(
        "count inactivity exemptions",
        countQuery,
        countParams,
      ),
    ]);

    return {
      exemptions: listResult.rows.map((row) => ({
        playerMinecraftUuid: row.player_minecraft_uuid,
        minecraftUsername: row.minecraft_username,
        discordId: row.discord_id,
        lastSeen: row.last_seen,
        reason: row.reason,
        createdByDiscordId: row.created_by_discord_id,
        createdByMinecraftUsername: row.created_by_minecraft_username,
        createdAt: row.created_at,
      })),
      total: countResult.rows[0]?.total ?? 0,
    };
  }
}
