import type { Pool, PoolClient } from "pg";
import { WorkshopModDependencyBaseQueries } from "@/generated/db/workshop_mod_dependency.queries";

/**
 * Custom queries for workshop_mod_dependency table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopModDependencyQueries extends WorkshopModDependencyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopModDependency[]> {
  //   const result = await this.db.query<WorkshopModDependency>(
  //     `SELECT * FROM workshop_mod_dependency WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
