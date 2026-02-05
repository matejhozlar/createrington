import type { Pool, PoolClient } from "pg";
import { PlayerBanBaseQueries } from "@/generated/db/player_ban.queries";

/**
 * Custom queries for player_ban table
 * 
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class PlayerBanQueries extends PlayerBanBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Add your custom query methods here
  // Example:
  // async findByCustomCriteria(criteria: CustomType): Promise<PlayerBan[]> {
  //   const result = await this.db.query<PlayerBan>(
  //     `SELECT * FROM player_ban WHERE ...`,
  //     [criteria]
  //   );
  //   return result.rows;
  // }
}
