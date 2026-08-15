import type { Pool, PoolClient } from "pg";
import { ModpackModBaseQueries } from "@/generated/db/modpack_mod.queries";

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
