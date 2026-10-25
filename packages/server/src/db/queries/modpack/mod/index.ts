import type { Pool, PoolClient } from "pg";
import { ModpackModBaseQueries } from "@/generated/db/modpack_mod.queries";

export interface ModpackModSample {
  id: number;
  name: string;
  thumbnailUrl: string | null;
}

export interface ModpackModCounts {
  modCount: number;
  liveCount: number;
}

/**
 * Custom queries for modpack_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class ModpackModQueries extends ModpackModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Member and live member counts per modpack; packs without members are absent. */
  async getCountsByModpack(): Promise<Map<number, ModpackModCounts>> {
    const query = `
      SELECT modpack_id,
             COUNT(*)::int AS mod_count,
             COUNT(*) FILTER (WHERE live_at IS NOT NULL)::int AS live_count
      FROM ${this.table}
      GROUP BY modpack_id`;
    const result = await this.runQuery<{
      modpack_id: number;
      mod_count: number;
      live_count: number;
    }>("count modpack members by modpack", query);
    return new Map(
      result.rows.map((row) => [
        row.modpack_id,
        { modCount: row.mod_count, liveCount: row.live_count },
      ]),
    );
  }

  /** The newest members of a pack that are not dropped, with their cached project. */
  async getSampleWithProjects(
    modpackId: number,
    limit: number,
  ): Promise<ModpackModSample[]> {
    const query = `
      SELECT mm.id, cp.name, cp.thumbnail_url
      FROM ${this.table} mm
      JOIN curseforge_project cp ON cp.id = mm.curseforge_project_id
      WHERE mm.modpack_id = $1 AND mm.dropped_from_manifest_at IS NULL
      ORDER BY mm.created_at DESC, mm.id DESC
      LIMIT $2`;
    const result = await this.runQuery<{
      id: number;
      name: string;
      thumbnail_url: string | null;
    }>("sample modpack members with projects", query, [modpackId, limit]);
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      thumbnailUrl: row.thumbnail_url,
    }));
  }

  // Points members at the files a manifest ships, in one statement. Rows whose
  // file already matches are left alone so updated_at keeps meaning something
  async applyManifestFiles(
    modpackId: number,
    files: Array<{
      curseforgeProjectId: number;
      fileId: number;
      fileName: string | null;
      fileReleaseType: number | null;
    }>,
  ): Promise<void> {
    if (files.length === 0) return;

    await this.runQuery(
      "apply manifest files to pack members",
      `UPDATE ${this.table} m
       SET file_id = d.file_id,
           file_name = d.file_name,
           file_release_type = d.release_type,
           updated_at = NOW()
       FROM UNNEST($2::int[], $3::int[], $4::text[], $5::int[])
         AS d(project_id, file_id, file_name, release_type)
       WHERE m.modpack_id = $1
         AND m.curseforge_project_id = d.project_id
         AND m.file_id IS DISTINCT FROM d.file_id`,
      [
        modpackId,
        files.map((file) => file.curseforgeProjectId),
        files.map((file) => file.fileId),
        files.map((file) => file.fileName),
        files.map((file) => file.fileReleaseType),
      ],
    );
  }
}
