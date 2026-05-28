import type { Pool, PoolClient } from "pg";
import { ServerAllyQualifiedPlayerBaseQueries } from "@/generated/db/server_ally_qualified_player.queries";

export class ServerAllyQualifiedPlayerQueries extends ServerAllyQualifiedPlayerBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Returns the ally status for a single player on a given server, or null if
   * the player has not qualified.
   */
  async getStatusForPlayer(serverId: number, playerUuid: string) {
    const result = await this.db.query<{
      qualifiedAt: Date;
      isPending: boolean;
    }>(
      `SELECT qualified_at AS "qualifiedAt", is_pending AS "isPending"
        FROM server_ally_qualified_player
        WHERE server_id = $1 AND player_uuid = $2`,
      [serverId, playerUuid],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Returns the alliance timestamp for the party containing the given player,
   * if any. Joins through server_forceload_member to find the player's party
   * and through server_ally_party to find when it was allied.
   */
  async getPartyAlliance(serverId: number, playerUuid: string) {
    const result = await this.db.query<{
      partyId: string;
      partyName: string | null;
      alliedAt: Date;
    }>(
      `SELECT
        ap.party_id AS "partyId",
        fp.party_name AS "partyName",
        ap.allied_at AS "alliedAt"
      FROM server_forceload_member fm
      JOIN server_forceload_party fp ON fp.id = fm.party_id
      JOIN server_ally_party ap
        ON ap.party_id = fp.party_id AND ap.server_id = fp.server_id
      WHERE fp.server_id = $1 AND fm.player_uuid = $2
      LIMIT 1`,
      [serverId, playerUuid],
    );
    return result.rows[0] ?? null;
  }
}
