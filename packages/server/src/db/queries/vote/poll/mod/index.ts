import type { Pool, PoolClient } from "pg";
import { VotePollModBaseQueries } from "@/generated/db/vote_poll_mod.queries";

/**
 * Custom queries for vote_poll_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VotePollModQueries extends VotePollModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VotePollMod[]> {
  //   const result = await this.db.query<VotePollMod>(
  //     `SELECT * FROM vote_poll_mod WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
