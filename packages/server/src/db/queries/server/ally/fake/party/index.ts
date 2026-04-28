import type { Pool, PoolClient } from "pg";
import { ServerAllyFakePartyBaseQueries } from "@/generated/db/server_ally_fake_party.queries";

export class ServerAllyFakePartyQueries extends ServerAllyFakePartyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getFakePartyWithMembers(serverId: number) {
    const partyResult = await this.db.query<{
      id: number;
      partyId: string;
      ownerUuid: string;
      ownerName: string;
      syncedAt: Date;
    }>(
      `SELECT id, party_id AS "partyId", owner_uuid AS "ownerUuid",
              owner_name AS "ownerName", synced_at AS "syncedAt"
        FROM server_ally_fake_party
        WHERE server_id = $1`,
      [serverId],
    );
    const party = partyResult.rows[0];
    if (!party) return null;

    const memberResult = await this.db.query<{
      playerUuid: string;
      minecraftUsername: string | null;
    }>(
      `SELECT
          fpm.player_uuid AS "playerUuid",
          p.minecraft_username AS "minecraftUsername"
        FROM server_ally_fake_party_member fpm
        LEFT JOIN player p ON p.minecraft_uuid = fpm.player_uuid
        WHERE fpm.fake_party_id = $1
        ORDER BY p.minecraft_username ASC NULLS LAST`,
      [party.id],
    );

    return { ...party, members: memberResult.rows };
  }
}
