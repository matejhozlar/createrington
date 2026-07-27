import type { Pool, PoolClient } from "pg";
import { VoteModBanBaseQueries } from "@/generated/db/vote_mod_ban.queries";

/**
 * Custom queries for vote_mod_ban table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteModBanQueries extends VoteModBanBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VoteModBan[]> {
  //   const result = await this.db.query<VoteModBan>(
  //     `SELECT * FROM vote_mod_ban WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
