import type { Pool, PoolClient } from "pg";
import { ServerAllyFakePartyMemberBaseQueries } from "@/generated/db/server_ally_fake_party_member.queries";

/**
 * Custom queries for server_ally_fake_party_member table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ServerAllyFakePartyMemberQueries extends ServerAllyFakePartyMemberBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<ServerAllyFakePartyMember[]> {
  //   const result = await this.db.query<ServerAllyFakePartyMember>(
  //     `SELECT * FROM server_ally_fake_party_member WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
