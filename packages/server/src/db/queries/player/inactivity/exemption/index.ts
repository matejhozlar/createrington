import type { Pool, PoolClient } from "pg";
import { PlayerInactivityExemptionBaseQueries } from "@/generated/db/player_inactivity_exemption.queries";
import { escapeLike } from "@/db/utils";

/**
 * Exemption row joined with the exempted player and the creating admin's
 * current Minecraft username. Both creator fields are null once the admin's
 * player record has been deleted.
 */
export interface ExemptionListItem {
  playerMinecraftUuid: string;
  minecraftUsername: string;
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
   * Insert an exemption unless the player already has one. Returns true when
   * a row was inserted and false when the player was already exempt, so a
   * concurrent duplicate never surfaces as a primary key violation.
   */
  async createIfAbsent(data: {
    playerMinecraftUuid: string;
    reason: string | null;
    createdByDiscordId: string;
  }): Promise<boolean> {
    const result = await this.runQuery(
      "create inactivity exemption",
      `INSERT INTO player_inactivity_exemption (player_minecraft_uuid, reason, created_by_discord_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_minecraft_uuid) DO NOTHING`,
      [data.playerMinecraftUuid, data.reason, data.createdByDiscordId],
    );

    return (result.rowCount ?? 0) === 1;
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
      const escaped = escapeLike(params.search);
      listParams.push(escaped);
      listSearchClause = `WHERE p.minecraft_username ILIKE '%' || $${listParams.length} || '%'`;
      countParams.push(escaped);
      countSearchClause = `WHERE p.minecraft_username ILIKE '%' || $${countParams.length} || '%'`;
    }

    const listQuery = `
      SELECT
        e.player_minecraft_uuid,
        e.reason,
        e.created_by_discord_id,
        e.created_at,
        p.minecraft_username,
        p.last_seen,
        a.minecraft_username AS created_by_minecraft_username
      FROM player_inactivity_exemption e
      INNER JOIN player p ON p.minecraft_uuid = e.player_minecraft_uuid
      LEFT JOIN player a ON a.discord_id = e.created_by_discord_id
      ${listSearchClause}
      ORDER BY e.created_at DESC, e.player_minecraft_uuid
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
