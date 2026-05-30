import type { Pool, PoolClient } from "pg";
import { PlayerPromptResponseBaseQueries } from "@/generated/db/player_prompt_response.queries";
import type { PlayerPromptResponse } from "@createrington/shared/db/player_prompt_response.types";

/**
 * Response joined with the responder's player row (when linked). The
 * extra `minecraftUsername` is null when the Discord user hasn't linked
 * a Minecraft account; the response is still attributed via discord_id.
 */
export interface PlayerPromptResponseWithPlayer extends PlayerPromptResponse {
  minecraftUsername: string | null;
}

/**
 * Custom queries for player_prompt_response table.
 *
 * The upsert is the hot path: every modal submission runs through it
 * and must honour the (prompt_id, discord_id) unique index so editing an
 * answer replaces it in-place rather than creating a second row.
 */
export class PlayerPromptResponseQueries extends PlayerPromptResponseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Insert or update a response, keyed on (prompt_id, discord_id).
   * minecraftUuid is resolved by the service before this call; pass
   * null when the responder hasn't linked a Minecraft account.
   */
  async upsert(data: {
    promptId: number;
    discordId: string;
    minecraftUuid: string | null;
    responseText: string;
  }): Promise<PlayerPromptResponse> {
    const query = `
      INSERT INTO ${this.table}
        (prompt_id, discord_id, minecraft_uuid, response_text)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (prompt_id, discord_id) DO UPDATE SET
        response_text = EXCLUDED.response_text,
        minecraft_uuid = EXCLUDED.minecraft_uuid,
        updated_at = NOW()
      RETURNING *`;

    const result = await this.runQuery("upsert prompt response", query, [
      data.promptId,
      data.discordId,
      data.minecraftUuid,
      data.responseText,
    ]);
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * All responses for a prompt with the responder's Minecraft username
   * attached when linked. Ordered newest-first for the admin detail view.
   */
  async findByPromptIdWithPlayer(
    promptId: number,
  ): Promise<PlayerPromptResponseWithPlayer[]> {
    // Order by whichever of submitted_at / updated_at is newer so a
    // player editing their response resurfaces them at the top of the
    // admin review list, otherwise edits stay pinned at the original
    // submission time and get buried.
    const query = `
      SELECT r.*, p.minecraft_username
      FROM ${this.table} r
      LEFT JOIN player p ON p.minecraft_uuid = r.minecraft_uuid
      WHERE r.prompt_id = $1
      ORDER BY GREATEST(r.submitted_at, r.updated_at) DESC`;

    const result = await this.runQuery<
      Record<string, unknown> & { minecraft_username: string | null }
    >("find responses with player", query, [promptId]);
    return result.rows.map((row) => ({
      ...this.mapRowToEntity(row as never),
      minecraftUsername: row.minecraft_username,
    }));
  }

  /** Returns the current response for a (prompt, Discord user) or null. */
  async findByPromptAndDiscordId(
    promptId: number,
    discordId: string,
  ): Promise<PlayerPromptResponse | null> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE prompt_id = $1 AND discord_id = $2`;
    const result = await this.runQuery(
      "find response by prompt+discord",
      query,
      [promptId, discordId],
    );
    return result.rows.length ? this.mapRowToEntity(result.rows[0]) : null;
  }
}
