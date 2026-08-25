import type { Pool, PoolClient } from "pg";
import { ModpackReleaseModBaseQueries } from "@/generated/db/modpack_release_mod.queries";

export interface ReleaseModInsert {
  curseforgeProjectId: number;
  fileId: number;
  fileName: string | null;
  displayName: string | null;
  fileReleaseType: number | null;
  fileDate: Date | null;
  required: boolean;
}

export interface ReleaseModRow {
  curseforgeProjectId: number;
  fileId: number;
  fileName: string | null;
  displayName: string | null;
  fileReleaseType: number | null;
  fileDate: Date | null;
  required: boolean;
  classId: number;
  projectName: string;
  projectSlug: string;
  thumbnailUrl: string | null;
  websiteUrl: string | null;
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

  // Writes a release's whole membership in one statement via UNNEST, so it can
  // sit inside the same transaction as the release row without 200 round-trips
  async insertMany(releaseId: number, rows: ReleaseModInsert[]): Promise<void> {
    if (rows.length === 0) return;

    await this.runQuery(
      "insert release mods",
      `INSERT INTO ${this.table} (
        release_id, curseforge_project_id, file_id,
        file_name, display_name, file_release_type, file_date, required
      )
      SELECT $1, d.project_id, d.file_id,
             d.file_name, d.display_name, d.release_type, d.file_date, d.required
      FROM UNNEST(
        $2::int[], $3::int[], $4::text[], $5::text[], $6::int[], $7::timestamptz[],
        $8::boolean[]
      ) AS d(project_id, file_id, file_name, display_name, release_type, file_date, required)`,
      [
        releaseId,
        rows.map((row) => row.curseforgeProjectId),
        rows.map((row) => row.fileId),
        rows.map((row) => row.fileName),
        rows.map((row) => row.displayName),
        rows.map((row) => row.fileReleaseType),
        rows.map((row) => row.fileDate),
        rows.map((row) => row.required),
      ],
    );
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
        rm.required,
        p.class_id,
        p.name AS project_name,
        p.slug AS project_slug,
        p.thumbnail_url,
        p.website_url
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
      required: boolean;
      class_id: number;
      project_name: string;
      project_slug: string;
      thumbnail_url: string | null;
      website_url: string | null;
    }>("list release mods", query, [releaseIds]);

    return result.rows.map((row) => ({
      releaseId: row.release_id,
      curseforgeProjectId: row.curseforge_project_id,
      fileId: row.file_id,
      fileName: row.file_name,
      displayName: row.display_name,
      fileReleaseType: row.file_release_type,
      fileDate: row.file_date,
      required: row.required,
      classId: row.class_id,
      projectName: row.project_name,
      projectSlug: row.project_slug,
      thumbnailUrl: row.thumbnail_url,
      websiteUrl: row.website_url,
    }));
  }
}
