import type { Pool, PoolClient } from "pg";
import { ModpackPublishBaseQueries } from "@/generated/db/modpack_publish.queries";
import type { ModpackPublish } from "@createrington/shared/db";

/**
 * Custom queries for modpack_publish table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackPublishQueries extends ModpackPublishBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Newest reported publish per modpack (by client file id); packs without one are absent. */
  async latestPerModpack(modpackIds: number[]): Promise<ModpackPublish[]> {
    if (modpackIds.length === 0) return [];
    const result = await this.runQuery(
      "list latest publishes per modpack",
      `SELECT DISTINCT ON (modpack_id) *
       FROM ${this.table}
       WHERE modpack_id = ANY($1::int[])
       ORDER BY modpack_id, client_file_id DESC`,
      [modpackIds],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
