import type { Pool, PoolClient } from "pg";
import { PlayerPromptBaseQueries } from "@/generated/db/player_prompt.queries";
import type { PlayerPrompt } from "@createrington/shared/db/player_prompt.types";

/**
 * Custom queries for player_prompt table.
 *
 * Admin-facing views and service-level lookups used by the prompt timer to
 * find records that need closing on startup.
 */
export class PlayerPromptQueries extends PlayerPromptBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * List prompts with a derived response count.
   *
   * Used by the admin UI's list page. Ordered newest first so the most
   * recently created prompt sits at the top.
   */
  async listWithResponseCount(options: {
    limit: number;
    offset: number;
    status?: "active" | "closed";
  }): Promise<Array<PlayerPrompt & { responseCount: number }>> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (options.status) {
      params.push(options.status);
      conditions.push(`p.status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(options.limit);
    const limitParam = `$${params.length}`;
    params.push(options.offset);
    const offsetParam = `$${params.length}`;

    const query = `
      SELECT p.*, COALESCE(r.response_count, 0)::int AS response_count
      FROM ${this.table} p
      LEFT JOIN (
        SELECT prompt_id, COUNT(*)::int AS response_count
        FROM player_prompt_response
        GROUP BY prompt_id
      ) r ON r.prompt_id = p.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}`;

    try {
      const result = await this.db.query<
        Record<string, unknown> & { response_count: number }
      >(query, params);
      return result.rows.map((row) => ({
        ...this.mapRowToEntity(row as never),
        responseCount: row.response_count,
      }));
    } catch (error) {
      logger.error("Failed to list prompts with response count:", error);
      throw error;
    }
  }

  /**
   * All prompts whose status is still `active`. Used on service startup to
   * re-arm closure timers and on every timer tick to sanity-check.
   */
  async findAllActive(): Promise<PlayerPrompt[]> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE status = 'active'
      ORDER BY ends_at ASC`;
    try {
      const result = await this.db.query(query);
      return this.mapRowsToEntities(result.rows as PlayerPrompt[]);
    } catch (error) {
      logger.error("Failed to find active prompts:", error);
      throw error;
    }
  }
}
