import type { Pool, PoolClient } from "pg";
import type { CamelCaseKeys } from "@createrington/shared/types";
import { PlayerInactivityExemptionBaseQueries } from "@/generated/db/player_inactivity_exemption.queries";
import { escapeLike } from "@/db/utils";

export interface ExemptionRow {
  player_minecraft_uuid: string;
  minecraft_username: string;
  last_seen: Date;
  reason: string | null;
  created_by_discord_id: string | null;
  created_by_minecraft_username: string | null;
  created_at: Date;
}

/**
 * Exemption row joined with the exempted player and the creating admin's
 * current Minecraft username. Both creator fields are null once the admin's
 * player record has been deleted.
 */
export type ExemptionListItem = CamelCaseKeys<ExemptionRow>;

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
      `INSERT INTO ${this.table} (player_minecraft_uuid, reason, created_by_discord_id)
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
    const values: unknown[] = params.search ? [escapeLike(params.search)] : [];
    const where = params.search
      ? "p.minecraft_username ILIKE '%' || $1 || '%'"
      : "TRUE";
    const exempted = `FROM ${this.table} e
      INNER JOIN player p ON p.minecraft_uuid = e.player_minecraft_uuid`;

    const [listResult, countResult] = await Promise.all([
      this.runQuery<ExemptionRow>(
        "list inactivity exemptions",
        `SELECT
           e.player_minecraft_uuid,
           e.reason,
           e.created_by_discord_id,
           e.created_at,
           p.minecraft_username,
           p.last_seen,
           a.minecraft_username AS created_by_minecraft_username
         ${exempted}
         LEFT JOIN player a ON a.discord_id = e.created_by_discord_id
         WHERE ${where}
         ORDER BY e.created_at DESC, e.player_minecraft_uuid
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, params.limit, params.offset],
      ),
      this.runQuery<{ total: number }>(
        "count inactivity exemptions",
        `SELECT COUNT(*)::int AS total ${exempted} WHERE ${where}`,
        values,
      ),
    ]);

    return {
      exemptions: this.mapRowsToEntities(listResult.rows),
      total: countResult.rows[0]?.total ?? 0,
    };
  }
}
