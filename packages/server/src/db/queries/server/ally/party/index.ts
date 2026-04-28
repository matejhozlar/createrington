import type { Pool, PoolClient } from "pg";
import { ServerAllyPartyBaseQueries } from "@/generated/db/server_ally_party.queries";

export class ServerAllyPartyQueries extends ServerAllyPartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Returns allied parties joined to the OPAC (forceload) party tables so the
   * admin UI can show the party display name and current member roster.
   */
  async getAlliedPartiesWithMembers(serverId: number) {
    const result = await this.db.query<{
      id: number;
      partyId: string;
      alliedAt: Date;
      partyName: string | null;
      memberCount: number | null;
      members: { playerUuid: string; minecraftUsername: string | null }[];
    }>(
      `SELECT
        ap.id,
        ap.party_id AS "partyId",
        ap.allied_at AS "alliedAt",
        fp.party_name AS "partyName",
        fp.member_count AS "memberCount",
        COALESCE(m.members, '[]'::jsonb) AS members
      FROM server_ally_party ap
      LEFT JOIN server_forceload_party fp
        ON fp.party_id = ap.party_id AND fp.server_id = ap.server_id
      LEFT JOIN LATERAL (
        SELECT JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'playerUuid', fm.player_uuid,
            'minecraftUsername', p.minecraft_username
          )
          ORDER BY p.minecraft_username ASC NULLS LAST
        ) AS members
        FROM server_forceload_member fm
        LEFT JOIN player p ON p.minecraft_uuid = fm.player_uuid
        WHERE fm.party_id = fp.id
      ) m ON true
      WHERE ap.server_id = $1
      ORDER BY ap.allied_at DESC`,
      [serverId],
    );
    return result.rows;
  }
}
