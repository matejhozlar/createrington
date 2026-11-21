import type { Pool, PoolClient } from "pg";
import { ModpackReleaseAnnouncementBaseQueries } from "@/generated/db/modpack_release_announcement.queries";
import type { ModpackReleaseAnnouncementRow } from "@createrington/shared/db";
import type { CamelCaseKeys } from "@createrington/shared/types";

export interface ReleaseAnnouncementWithPresetRow extends ModpackReleaseAnnouncementRow {
  preset_name: string | null;
}

export type ReleaseAnnouncementRow =
  CamelCaseKeys<ReleaseAnnouncementWithPresetRow>;

export class ModpackReleaseAnnouncementQueries extends ModpackReleaseAnnouncementBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Announcement parts of releases with the name of the preset each one was saved as. */
  async listForReleases(
    releaseIds: number[],
  ): Promise<ReleaseAnnouncementRow[]> {
    if (releaseIds.length === 0) return [];
    const result = await this.runQuery<ReleaseAnnouncementWithPresetRow>(
      "list release announcements",
      `SELECT a.*, p.name AS preset_name
       FROM ${this.table} a
       LEFT JOIN discord_embed_preset p ON p.id = a.preset_id
       WHERE a.release_id = ANY($1::int[])
       ORDER BY a.release_id, a.part`,
      [releaseIds],
    );
    return this.mapRowsToEntities(result.rows);
  }
}
