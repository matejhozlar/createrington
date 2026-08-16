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
   * List prompts with derived entry and unique-responder counts.
   *
   * Used by the admin UI's list page. Ordered newest first so the most
   * recently created prompt sits at the top.
   */
  async listWithResponseCount(options: {
    limit: number;
    offset: number;
    status?: "active" | "closed";
  }): Promise<
    Array<PlayerPrompt & { responseCount: number; responderCount: number }>
  > {
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
      SELECT
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
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}`;

    const result = await this.runQuery<
      Record<string, unknown> & {
        response_count: number;
        responder_count: number;
      }
    >("list prompts with response count", query, params);
    return result.rows.map((row) => ({
      ...this.mapRowToEntity(row as never),
      responseCount: row.response_count,
      responderCount: row.responder_count,
    }));
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
    const result = await this.runQuery<Record<string, unknown>>(
      "find active prompts",
      query,
    );
    return result.rows.map((row) => this.mapRowToEntity(row as never));
  }
}
