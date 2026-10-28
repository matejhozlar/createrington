import type { Pool, PoolClient } from "pg";
import type { WorkshopModStatus } from "@createrington/shared/db";
import { WorkshopModBaseQueries } from "@/generated/db/workshop_mod.queries";

export interface WorkshopTopPendingMod {
  workshopModId: number;
  name: string;
  primaryAuthor: string | null;
  upvoteCount: number;
  thumbnailUrl: string | null;
}

export interface WorkshopProjectStanding {
  curseforgeProjectId: number;
  status: WorkshopModStatus | null;
  inPack: boolean;
}

/**
 * Custom queries for workshop_mod table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopModQueries extends WorkshopModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** The most upvoted pending suggestions of a workshop with their cached project, newest first on ties. */
  async getTopPendingByUpvotes(
    workshopId: number,
    limit: number,
  ): Promise<WorkshopTopPendingMod[]> {
    const query = `
      SELECT wm.id AS workshop_mod_id, cp.name, cp.primary_author,
             cp.thumbnail_url,
             (SELECT COUNT(*)::int FROM workshop_mod_upvote wmu
               WHERE wmu.workshop_mod_id = wm.id) AS upvote_count
      FROM ${this.table} wm
      JOIN curseforge_project cp ON cp.id = wm.curseforge_project_id
      WHERE wm.workshop_id = $1 AND wm.status = 'pending'
      ORDER BY upvote_count DESC, wm.created_at DESC, wm.id DESC
      LIMIT $2`;
    const result = await this.runQuery<{
      workshop_mod_id: number;
      name: string;
      primary_author: string | null;
      thumbnail_url: string | null;
      upvote_count: number;
    }>("top pending workshop mods by upvotes", query, [workshopId, limit]);
    return result.rows.map((row) => ({
      workshopModId: row.workshop_mod_id,
      name: row.name,
      primaryAuthor: row.primary_author,
      upvoteCount: row.upvote_count,
      thumbnailUrl: row.thumbnail_url,
    }));
  }

  /**
   * Where each project stands in a workshop: its suggestion status, if any,
   * and whether the workshop's modpack holds a row for it. One row per
   * project; `projectIds` narrows the read, omit it for the whole workshop.
   */
  async getProjectStandings(
    workshopId: number,
    modpackId: number,
    projectIds?: number[],
  ): Promise<WorkshopProjectStanding[]> {
    if (projectIds !== undefined && projectIds.length === 0) return [];

    const query = `
      SELECT COALESCE(wm.curseforge_project_id, mm.curseforge_project_id)
               AS curseforge_project_id,
             wm.status,
             (mm.id IS NOT NULL) AS in_pack
      FROM (
        SELECT curseforge_project_id, status
        FROM ${this.table}
        WHERE workshop_id = $1
          AND ($3::int[] IS NULL OR curseforge_project_id = ANY($3))
      ) wm
      FULL OUTER JOIN (
        SELECT id, curseforge_project_id
        FROM modpack_mod
        WHERE modpack_id = $2
          AND ($3::int[] IS NULL OR curseforge_project_id = ANY($3))
      ) mm ON mm.curseforge_project_id = wm.curseforge_project_id`;
    const result = await this.runQuery<{
      curseforge_project_id: number;
      status: WorkshopModStatus | null;
      in_pack: boolean;
    }>("workshop project standings", query, [
      workshopId,
      modpackId,
      projectIds ?? null,
    ]);
    return result.rows.map((row) => ({
      curseforgeProjectId: row.curseforge_project_id,
      status: row.status,
      inPack: row.in_pack,
    }));
  }
}
