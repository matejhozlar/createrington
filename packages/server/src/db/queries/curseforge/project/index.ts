import type { Pool, PoolClient } from "pg";
import { CurseforgeProjectBaseQueries } from "@/generated/db/curseforge_project.queries";

/**
 * Custom queries for curseforge_project table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CurseforgeProjectQueries extends CurseforgeProjectBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<CurseforgeProject[]> {
  //   const result = await this.db.query<CurseforgeProject>(
  //     `SELECT * FROM curseforge_project WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
