import type { Pool, PoolClient } from "pg";
import { ModpackReleaseBaseQueries } from "@/generated/db/modpack_release.queries";
import type { ModpackRelease } from "@createrington/shared/db";

/**
 * Custom queries for modpack_release table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackReleaseQueries extends ModpackReleaseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Newest recorded release per modpack; packs without a release are absent from the result. */
  async latestPerModpack(modpackIds: number[]): Promise<ModpackRelease[]> {
    if (modpackIds.length === 0) return [];
    const result = await this.runQuery(
      "list latest releases per modpack",
      `SELECT DISTINCT ON (modpack_id) *
       FROM ${this.table}
       WHERE modpack_id = ANY($1::int[])
       ORDER BY modpack_id, id DESC`,
      [modpackIds],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
