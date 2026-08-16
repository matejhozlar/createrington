import type { Pool, PoolClient } from "pg";
import { PlayerPromptResponseBaseQueries } from "@/generated/db/player_prompt_response.queries";
import { ConstraintViolationError, translateDbError } from "@/db/utils/errors";
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
 * What a single Discord user has submitted to one prompt so far. Drives the
 * multi-mode max-entries and cooldown gates without pulling every row.
 */
export interface PlayerPromptEntryStats {
  entryCount: number;
  lastEntryNumber: number;
  lastSubmittedAt: Date | null;
}

/** Entry and unique-responder totals for one prompt. */
export interface PlayerPromptResponseTotals {
  entryCount: number;
  responderCount: number;
}

const APPEND_ENTRY_ATTEMPTS = 3;

// Stand-in ceiling for prompts with no max_entries, so the cap check stays a
// single comparison instead of two query shapes. Well above the API's cap of
// MAX_ENTRIES_PER_PLAYER.
const UNCAPPED_ENTRIES = 2147483647;

/**
 * Custom queries for player_prompt_response table.
 *
 * Two write paths share the (prompt_id, discord_id, entry_number) unique
 * index: `upsertSingleEntry` pins entry 1 and replaces its text, while
 * `appendEntry` claims the next free number for multi-entry prompts.
 */
export class PlayerPromptResponseQueries extends PlayerPromptResponseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Insert or replace a player's sole entry on a single-mode prompt, keyed
   * on (prompt_id, discord_id, entry_number = 1). minecraftUuid is resolved
   * by the service before this call; pass null when the responder hasn't
   * linked a Minecraft account.
   */
  async upsertSingleEntry(data: {
    promptId: number;
    discordId: string;
    minecraftUuid: string | null;
    responseText: string;
  }): Promise<PlayerPromptResponse> {
    const query = `
      INSERT INTO ${this.table}
        (prompt_id, discord_id, entry_number, minecraft_uuid, response_text)
      VALUES ($1, $2, 1, $3, $4)
      ON CONFLICT (prompt_id, discord_id, entry_number) DO UPDATE SET
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
   * Append a new entry for a multi-mode prompt, claiming the next entry
   * number and enforcing both `maxEntries` and `cooldownSeconds` in the same
   * statement, so each rule is atomic with the row it guards. Returns null
   * when either bites: the HAVING filters the row out and nothing inserts.
   * The caller re-reads to decide which rule refused.
   *
   * Two submissions racing for the same entry number leave one rejected by
   * the unique index; that loser is retried, since its number is stale rather
   * than disallowed. The retry re-evaluates the HAVING against a fresh
   * snapshot, so it cannot smuggle an entry past a cap or a cooldown that the
   * winning insert just triggered.
   *
   * Runs against `this.db` rather than `runQuery` because a rejected attempt
   * is an expected, handled outcome: `runQuery` would log every one of them at
   * error level. Only an attempt that exhausts the retries is logged.
   */
  async appendEntry(data: {
    promptId: number;
    discordId: string;
    minecraftUuid: string | null;
    responseText: string;
    maxEntries: number | null;
    cooldownSeconds: number | null;
  }): Promise<PlayerPromptResponse | null> {
    const query = `
      INSERT INTO ${this.table}
        (prompt_id, discord_id, entry_number, minecraft_uuid, response_text)
      SELECT $1, $2, COALESCE(MAX(entry_number), 0) + 1, $3, $4
      FROM ${this.table}
      WHERE prompt_id = $1 AND discord_id = $2
      HAVING COUNT(*) < COALESCE($5::int, ${UNCAPPED_ENTRIES})
         AND ($6::int IS NULL
              OR COALESCE(MAX(submitted_at), to_timestamp(0))
                 <= NOW() - ($6::int * INTERVAL '1 second'))
      RETURNING *`;

    const params = [
      data.promptId,
      data.discordId,
      data.minecraftUuid,
      data.responseText,
      data.maxEntries,
      data.cooldownSeconds,
    ];

    for (let attempt = 1; ; attempt++) {
      try {
        const result = await this.db.query(query, params);
        return result.rows.length ? this.mapRowToEntity(result.rows[0]) : null;
      } catch (error) {
        const translated = translateDbError(error);
        if (
          !(translated instanceof ConstraintViolationError) ||
          attempt >= APPEND_ENTRY_ATTEMPTS
        ) {
          logger.error("Failed to append prompt entry:", error);
          throw translated;
        }
      }
    }
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

  /**
   * The most recent entry a (prompt, Discord user) pair holds, or null.
   * Single-mode prompts only ever have one, which is what the respond
   * modal prefills.
   */
  async findLatestEntry(
    promptId: number,
    discordId: string,
  ): Promise<PlayerPromptResponse | null> {
    const query = `
      SELECT * FROM ${this.table}
      WHERE prompt_id = $1 AND discord_id = $2
      ORDER BY entry_number DESC
      LIMIT 1`;
    const result = await this.runQuery(
      "find latest response by prompt+discord",
      query,
      [promptId, discordId],
    );
    return result.rows.length ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /** Entry count, highest entry number, and newest submission for one responder. */
  async getEntryStats(
    promptId: number,
    discordId: string,
  ): Promise<PlayerPromptEntryStats> {
    const query = `
      SELECT
        COUNT(*)::int AS entry_count,
        COALESCE(MAX(entry_number), 0)::int AS last_entry_number,
        MAX(submitted_at) AS last_submitted_at
      FROM ${this.table}
      WHERE prompt_id = $1 AND discord_id = $2`;

    const result = await this.runQuery<{
      entry_count: number;
      last_entry_number: number;
      last_submitted_at: Date | null;
    }>("get prompt entry stats", query, [promptId, discordId]);

    const row = result.rows[0];
    return {
      entryCount: row.entry_count,
      lastEntryNumber: row.last_entry_number,
      lastSubmittedAt: row.last_submitted_at,
    };
  }

  /** Total entries and distinct responders for a prompt. */
  async countByPrompt(promptId: number): Promise<PlayerPromptResponseTotals> {
    const query = `
      SELECT
        COUNT(*)::int AS entry_count,
        COUNT(DISTINCT discord_id)::int AS responder_count
      FROM ${this.table}
      WHERE prompt_id = $1`;

    const result = await this.runQuery<{
      entry_count: number;
      responder_count: number;
    }>("count prompt responses", query, [promptId]);

    return {
      entryCount: result.rows[0].entry_count,
      responderCount: result.rows[0].responder_count,
    };
  }
}
