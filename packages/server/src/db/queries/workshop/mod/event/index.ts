import type { Pool, PoolClient } from "pg";
import { WorkshopModEventBaseQueries } from "@/generated/db/workshop_mod_event.queries";
import { escapeLike } from "@/db/utils";
import type {
  WorkshopModEvent,
  WorkshopModEventType,
} from "@createrington/shared/db";

export interface WorkshopModEventListItem extends WorkshopModEvent {
  project: {
    name: string | null;
    slug: string | null;
    thumbnailUrl: string | null;
    classId: number | null;
  };
  actor: { minecraftUsername: string; minecraftUuid: string } | null;
  modExists: boolean;
}

interface SearchRow extends Record<string, unknown> {
  project_name: string | null;
  project_slug: string | null;
  project_thumbnail_url: string | null;
  project_class_id: number | null;
  actor_username: string | null;
  actor_uuid: string | null;
  mod_exists: boolean;
}

const SEARCH_JOINS = `
  LEFT JOIN curseforge_project cp ON cp.id = e.curseforge_project_id
  LEFT JOIN player p ON p.discord_id = e.actor_discord_id`;

const ROW_JOINS = `${SEARCH_JOINS}
  LEFT JOIN workshop_mod m ON m.id = e.workshop_mod_id`;

/**
 * Custom queries for workshop_mod_event table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class WorkshopModEventQueries extends WorkshopModEventBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Newest-first page of a workshop's timeline with the project, the acting
   * player, and whether the suggestion row still exists resolved per event.
   * Search matches the project name or the actor's Minecraft username.
   */
  async search(opts: {
    workshopId: number;
    eventType?: WorkshopModEventType;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ events: WorkshopModEventListItem[]; total: number }> {
    const conditions = ["e.workshop_id = $1"];
    const params: unknown[] = [opts.workshopId];

    if (opts.eventType) {
      params.push(opts.eventType);
      conditions.push(`e.event_type = $${params.length}`);
    }

    if (opts.search) {
      params.push(`%${escapeLike(opts.search)}%`);
      conditions.push(
        `(cp.name ILIKE $${params.length} OR p.minecraft_username ILIKE $${params.length})`,
      );
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const countJoins = opts.search ? SEARCH_JOINS : "";

    const [dataResult, countResult] = await Promise.all([
      this.db.query<SearchRow>(
        `SELECT e.*,
           cp.name AS project_name,
           cp.slug AS project_slug,
           cp.thumbnail_url AS project_thumbnail_url,
           cp.class_id AS project_class_id,
           p.minecraft_username AS actor_username,
           p.minecraft_uuid AS actor_uuid,
           (m.id IS NOT NULL) AS mod_exists
         FROM workshop_mod_event e
         ${ROW_JOINS}
         ${where}
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, opts.limit, opts.offset],
      ),
      this.db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM workshop_mod_event e
         ${countJoins}
         ${where}`,
        params,
      ),
    ]);

    return {
      events: dataResult.rows.map((row) => this.mapSearchRow(row)),
      total: countResult.rows[0]?.count ?? 0,
    };
  }

  private mapSearchRow(row: SearchRow): WorkshopModEventListItem {
    const {
      project_name,
      project_slug,
      project_thumbnail_url,
      project_class_id,
      actor_username,
      actor_uuid,
      mod_exists,
      ...eventRow
    } = row;
    return {
      ...this.mapRowToEntity(eventRow as WorkshopModEvent),
      project: {
        name: project_name,
        slug: project_slug,
        thumbnailUrl: project_thumbnail_url,
        classId: project_class_id,
      },
      actor:
        actor_username && actor_uuid
          ? { minecraftUsername: actor_username, minecraftUuid: actor_uuid }
          : null,
      modExists: mod_exists,
    };
  }
}
