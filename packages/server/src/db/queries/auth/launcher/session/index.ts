import type { Pool, PoolClient } from "pg";
import { AuthLauncherSessionBaseQueries } from "@/generated/db/auth_launcher_session.queries";

/**
 * Custom queries for auth_launcher_session table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class AuthLauncherSessionQueries extends AuthLauncherSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<AuthLauncherSession[]> {
  //   const result = await this.db.query<AuthLauncherSession>(
  //     `SELECT * FROM auth_launcher_session WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
