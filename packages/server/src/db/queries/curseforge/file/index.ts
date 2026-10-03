import type { Pool, PoolClient } from "pg";
import { CurseforgeFileBaseQueries } from "@/generated/db/curseforge_file.queries";
import type { CurseforgeFileSource } from "@createrington/shared/db";

export interface CurseforgeFileUpsert {
  id: number;
  curseforgeProjectId: number;
  fileName: string;
  fileSize: number;
  sha1: string;
  source: CurseforgeFileSource;
  downloadUrl: string | null;
}

export interface CurseforgeFileWithProject extends CurseforgeFileUpsert {
  resolvedAt: Date;
  classId: number;
  slug: string;
  websiteUrl: string | null;
}

/**
 * Custom queries for curseforge_file table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CurseforgeFileQueries extends CurseforgeFileBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // A release resolves a few hundred files at once, so the whole batch goes
  // in one statement via UNNEST. A file resolved again replaces its row
  async upsertMany(rows: CurseforgeFileUpsert[]): Promise<void> {
    if (rows.length === 0) return;

    await this.runQuery(
      "upsert curseforge files",
      `INSERT INTO ${this.table} (
        id, curseforge_project_id, file_name, file_size, sha1, source,
        download_url, resolved_at
      )
      SELECT d.id, d.project_id, d.file_name, d.file_size, d.sha1, d.source,
             d.download_url, NOW()
      FROM UNNEST(
        $1::int[], $2::int[], $3::text[], $4::int[], $5::text[],
        $6::curseforge_file_source[], $7::text[]
      ) AS d(id, project_id, file_name, file_size, sha1, source, download_url)
      ON CONFLICT (id) DO UPDATE SET
        curseforge_project_id = EXCLUDED.curseforge_project_id,
        file_name = EXCLUDED.file_name,
        file_size = EXCLUDED.file_size,
        sha1 = EXCLUDED.sha1,
        source = EXCLUDED.source,
        download_url = EXCLUDED.download_url,
        resolved_at = EXCLUDED.resolved_at`,
      [
        rows.map((row) => row.id),
        rows.map((row) => row.curseforgeProjectId),
        rows.map((row) => row.fileName),
        rows.map((row) => row.fileSize),
        rows.map((row) => row.sha1),
        rows.map((row) => row.source),
        rows.map((row) => row.downloadUrl),
      ],
    );
  }

  /** Stored files by id, joined to the project for its class and page; unknown ids are absent. */
  async getWithProject(
    fileIds: number[],
  ): Promise<CurseforgeFileWithProject[]> {
    if (fileIds.length === 0) return [];

    const result = await this.runQuery<{
      id: number;
      curseforge_project_id: number;
      file_name: string;
      file_size: number;
      sha1: string;
      source: CurseforgeFileSource;
      download_url: string | null;
      resolved_at: Date;
      class_id: number;
      slug: string;
      website_url: string | null;
    }>(
      "list curseforge files with project",
      `SELECT
        f.id,
        f.curseforge_project_id,
        f.file_name,
        f.file_size,
        f.sha1,
        f.source,
        f.download_url,
        f.resolved_at,
        p.class_id,
        p.slug,
        p.website_url
      FROM ${this.table} f
      JOIN curseforge_project p ON p.id = f.curseforge_project_id
      WHERE f.id = ANY($1::int[])`,
      [fileIds],
    );

    return result.rows.map((row) => ({
      id: row.id,
      curseforgeProjectId: row.curseforge_project_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      sha1: row.sha1,
      source: row.source,
      downloadUrl: row.download_url,
      resolvedAt: row.resolved_at,
      classId: row.class_id,
      slug: row.slug,
      websiteUrl: row.website_url,
    }));
  }
}
