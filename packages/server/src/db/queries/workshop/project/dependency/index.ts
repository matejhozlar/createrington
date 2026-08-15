import type { Pool, PoolClient } from "pg";
import { WorkshopProjectDependencyBaseQueries } from "@/generated/db/workshop_project_dependency.queries";

/**
 * Custom queries for workshop_project_dependency table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopProjectDependencyQueries extends WorkshopProjectDependencyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<WorkshopProjectDependency[]> {
  //   const result = await this.db.query<WorkshopProjectDependency>(
  //     `SELECT * FROM workshop_project_dependency WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
