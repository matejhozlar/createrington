import type { Pool, PoolClient } from "pg";
import { PlayerPromptBaseQueries } from "@/generated/db/player_prompt.queries";
import type {
  PlayerPrompt,
  PlayerPromptRow,
} from "@createrington/shared/db/player_prompt.types";

type PromptWithCountsRow = PlayerPromptRow & {
  response_count: number;
  responder_count: number;
};

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
   * List prompts with derived entry and unique-responder counts, with the
   * total matching count.
   *
   * Used by the admin UI's list page. Ordered newest first so the most
   * recently created prompt sits at the top.
   */
  async getWithResponseCount(
    filters: { status?: PlayerPrompt["status"] },
    options: { limit: number; offset: number },
  ): Promise<{
    rows: Array<
      PlayerPrompt & { responseCount: number; responderCount: number }
    >;
    total: number;
  }> {
    const { whereClause, params } = this.buildFilterClause(filters);

    const [result, count] = await Promise.all([
      this.runQuery<PromptWithCountsRow>(
        "list prompts with response count",
        `SELECT
           p.*,
           COALESCE(r.response_count, 0)::int AS response_count,
           COALESCE(r.responder_count, 0)::int AS responder_count
         FROM ${this.table} p
         LEFT JOIN (
           SELECT
             prompt_id,
             COUNT(*)::int AS response_count,
             COUNT(DISTINCT discord_id)::int AS responder_count
           FROM player_prompt_response
           GROUP BY prompt_id
         ) r ON r.prompt_id = p.id
         WHERE ${whereClause}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, options.limit, options.offset],
      ),
      this.runQuery<{ total: number }>(
        "count prompts",
        `SELECT COUNT(*)::int AS total FROM ${this.table} WHERE ${whereClause}`,
        params,
      ),
    ]);
    return {
      rows: this.mapRowsToEntities(result.rows),
      total: count.rows[0]?.total ?? 0,
    };
  }

  /**
   * All prompts whose status is still `active`. Used on service startup to
   * re-arm closure timers and on every timer tick to sanity-check.
   */
  async getActive(): Promise<PlayerPrompt[]> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE status = 'active'
      ORDER BY ends_at ASC`;
    const result = await this.runQuery<PlayerPromptRow>(
      "find active prompts",
      query,
    );
    return this.mapRowsToEntities(result.rows);
  }
}
