import type { Pool, PoolClient } from "pg";
import { VoteModDependencyBaseQueries } from "@/generated/db/vote_mod_dependency.queries";

/**
 * Custom queries for vote_mod_dependency table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class VoteModDependencyQueries extends VoteModDependencyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<VoteModDependency[]> {
  //   const result = await this.db.query<VoteModDependency>(
  //     `SELECT * FROM vote_mod_dependency WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
