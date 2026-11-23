import type { Pool, PoolClient } from "pg";
import { ModpackReleaseBaseQueries } from "@/generated/db/modpack_release.queries";
import type {
  ModpackRelease,
  ModpackReleaseRow,
} from "@createrington/shared/db";

export interface PrecedingReleaseRow extends ModpackReleaseRow {
  successor_id: number;
}

export class ModpackReleaseQueries extends ModpackReleaseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Newest recorded release of a modpack, optionally of one version or among launcher-ready releases only; null when none matches. */
  async findLatest(
    modpackId: number,
    options: { version?: string; readyOnly?: boolean } = {},
  ): Promise<ModpackRelease | null> {
    const [release] = await this.findAll(
      {
        modpackId,
        version: options.version,
        launcherReadyAt: options.readyOnly ? { $ne: null } : undefined,
      },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );
    return release ?? null;
  }

  /** Newest recorded release per modpack; packs without a release are absent from the result. */
  async getLatestPerModpack(modpackIds: number[]): Promise<ModpackRelease[]> {
    if (modpackIds.length === 0) return [];
    const result = await this.runQuery<ModpackReleaseRow>(
      "list latest releases per modpack",
      `SELECT DISTINCT ON (modpack_id) *
       FROM ${this.table}
       WHERE modpack_id = ANY($1::int[])
       ORDER BY modpack_id, id DESC`,
      [modpackIds],
    );
    return this.mapRowsToEntities(result.rows);
  }

  /** The release recorded right before each given one in its modpack, tagged with the id of the release it precedes; a modpack's first release has no row. */
  async getPreceding(
    releaseIds: number[],
  ): Promise<Array<ModpackRelease & { successorId: number }>> {
    if (releaseIds.length === 0) return [];
    const result = await this.runQuery<PrecedingReleaseRow>(
      "list preceding releases",
      `SELECT prev.*, target.id AS successor_id
       FROM ${this.table} target
       JOIN LATERAL (
         SELECT *
         FROM ${this.table} p
         WHERE p.modpack_id = target.modpack_id AND p.id < target.id
         ORDER BY p.id DESC
         LIMIT 1
       ) prev ON TRUE
       WHERE target.id = ANY($1::int[])`,
      [releaseIds],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
