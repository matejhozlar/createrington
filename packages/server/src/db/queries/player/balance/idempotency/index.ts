import type { Pool, PoolClient } from "pg";
import { PlayerBalanceIdempotencyBaseQueries } from "@/generated/db/player_balance_idempotency.queries";

const RETENTION = "24 hours";

/**
 * Custom queries for player_balance_idempotency table
 *
 * - Atomic claim of a (player, key) slot, reclaiming rows past retention
 * - Retention cleanup
 */
export class PlayerBalanceIdempotencyQueries extends PlayerBalanceIdempotencyBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Claims the (player, key) slot for the calling transaction: inserts a fresh
   * row, or takes over an existing one whose retention has elapsed. A
   * concurrent claim of the same slot blocks on the primary key until the
   * holder commits or rolls back, so at most one request processes a given
   * key at a time and the loser sees the winner's stored response.
   *
   * @returns true when the slot was claimed, false when an unexpired row exists
   */
  async claim(params: {
    playerMinecraftUuid: string;
    idempotencyKey: string;
    requestHash: string;
  }): Promise<boolean> {
    const query = `
      INSERT INTO ${this.table} (player_minecraft_uuid, idempotency_key, request_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (player_minecraft_uuid, idempotency_key) DO UPDATE
        SET request_hash = EXCLUDED.request_hash,
            status_code = NULL,
            response_body = NULL,
            created_at = now()
        WHERE ${this.table}.created_at < now() - $4::interval
      RETURNING idempotency_key`;

    const result = await this.runQuery("claim idempotency slot", query, [
      params.playerMinecraftUuid,
      params.idempotencyKey,
      params.requestHash,
      RETENTION,
    ]);

    return result.rows.length === 1;
  }

  /**
   * Deletes rows past retention.
   *
   * @returns Number of rows removed
   */
  async deleteExpired(): Promise<number> {
    const query = `
      DELETE FROM ${this.table}
      WHERE created_at < now() - $1::interval`;

    const result = await this.runQuery(
      "delete expired idempotency rows",
      query,
      [RETENTION],
    );

    return result.rowCount ?? 0;
  }
}
