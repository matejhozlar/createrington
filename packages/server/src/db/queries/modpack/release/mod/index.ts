import type { Pool, PoolClient } from "pg";
import { ModpackReleaseModBaseQueries } from "@/generated/db/modpack_release_mod.queries";

export interface ReleaseModRow {
  curseforgeProjectId: number;
  fileId: number;
  fileName: string | null;
  displayName: string | null;
  fileReleaseType: number | null;
  fileDate: Date | null;
  projectName: string;
  projectSlug: string;
  thumbnailUrl: string | null;
}

/**
 * Custom queries for modpack_release_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackReleaseModQueries extends ModpackReleaseModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Frozen membership of releases, joined to the projects for display. */
  async listForReleases(
    releaseIds: number[],
  ): Promise<Array<ReleaseModRow & { releaseId: number }>> {
    if (releaseIds.length === 0) return [];
    const query = `
      SELECT
        rm.release_id,
        rm.curseforge_project_id,
        rm.file_id,
        rm.file_name,
        rm.display_name,
        rm.file_release_type,
        rm.file_date,
        p.name AS project_name,
        p.slug AS project_slug,
        p.thumbnail_url
      FROM ${this.table} rm
      JOIN curseforge_project p ON p.id = rm.curseforge_project_id
      WHERE rm.release_id = ANY($1::int[])
      ORDER BY p.name ASC`;
    const result = await this.runQuery<{
      release_id: number;
      curseforge_project_id: number;
      file_id: number;
      file_name: string | null;
      display_name: string | null;
      file_release_type: number | null;
      file_date: Date | null;
      project_name: string;
      project_slug: string;
      thumbnail_url: string | null;
    }>("list release mods", query, [releaseIds]);

    return result.rows.map((row) => ({
      releaseId: row.release_id,
      curseforgeProjectId: row.curseforge_project_id,
      fileId: row.file_id,
      fileName: row.file_name,
      displayName: row.display_name,
      fileReleaseType: row.file_release_type,
      fileDate: row.file_date,
      projectName: row.project_name,
      projectSlug: row.project_slug,
      thumbnailUrl: row.thumbnail_url,
    }));
  }
}
