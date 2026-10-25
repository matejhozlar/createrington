import type { Pool, PoolClient } from "pg";
import { WorkshopProjectDependencyBaseQueries } from "@/generated/db/workshop_project_dependency.queries";

export interface WorkshopDependencyGroup {
  dependsOnProjectId: number;
  requiredByProjectIds: number[];
  optionalByCount: number;
}

/**
 * Custom queries for workshop_project_dependency table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopProjectDependencyQueries extends WorkshopProjectDependencyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * How many distinct shipping projects (a modpack row or a suggestion staged
   * for the next update or in the pack) require each dependency. Missing ids
   * mean zero; `projectIds` narrows the dependencies counted.
   */
  async getShippingDemand(
    workshopId: number,
    modpackId: number,
    relationType: number,
    projectIds?: number[],
  ): Promise<Map<number, number>> {
    if (projectIds !== undefined && projectIds.length === 0) return new Map();

    const query = `
      SELECT e.depends_on_project_id,
             COUNT(DISTINCT e.curseforge_project_id)::int AS demand
      FROM ${this.table} e
      WHERE e.workshop_id = $1
        AND e.relation_type = $3
        AND ($4::int[] IS NULL OR e.depends_on_project_id = ANY($4))
        AND (
          EXISTS (
            SELECT 1 FROM modpack_mod mm
            WHERE mm.modpack_id = $2
              AND mm.curseforge_project_id = e.curseforge_project_id
          )
          OR EXISTS (
            SELECT 1 FROM workshop_mod wm
            WHERE wm.workshop_id = $1
              AND wm.curseforge_project_id = e.curseforge_project_id
              AND wm.status IN ('next_update', 'in_pack')
          )
        )
      GROUP BY e.depends_on_project_id`;
    const result = await this.runQuery<{
      depends_on_project_id: number;
      demand: number;
    }>("workshop dependency shipping demand", query, [
      workshopId,
      modpackId,
      relationType,
      projectIds ?? null,
    ]);
    return new Map(
      result.rows.map((row) => [row.depends_on_project_id, row.demand]),
    );
  }

  /**
   * One row per depended-on project of a workshop: which projects require
   * it and how many list it as optional.
   */
  async getGroupsByDependency(
    workshopId: number,
    requiredRelationType: number,
  ): Promise<WorkshopDependencyGroup[]> {
    const query = `
      SELECT depends_on_project_id,
             COALESCE(
               ARRAY_AGG(DISTINCT curseforge_project_id)
                 FILTER (WHERE relation_type = $2),
               '{}'
             ) AS required_by_project_ids,
             COUNT(DISTINCT curseforge_project_id)
               FILTER (WHERE relation_type <> $2)::int AS optional_by_count
      FROM ${this.table}
      WHERE workshop_id = $1
      GROUP BY depends_on_project_id
      ORDER BY depends_on_project_id`;
    const result = await this.runQuery<{
      depends_on_project_id: number;
      required_by_project_ids: number[];
      optional_by_count: number;
    }>("workshop dependency groups", query, [workshopId, requiredRelationType]);
    return result.rows.map((row) => ({
      dependsOnProjectId: row.depends_on_project_id,
      requiredByProjectIds: row.required_by_project_ids,
      optionalByCount: row.optional_by_count,
    }));
  }
}
