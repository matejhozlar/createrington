import type { Pool, PoolClient } from "pg";
import { ServerPartyClaimSyncBaseQueries } from "@/generated/db/server_party_claim_sync.queries";

/**
 * Queries over the last claim snapshot each server sent (hash, chunk count,
 * sync time), plus the per-server lock that serializes snapshot writes.
 */
export class ServerPartyClaimSyncQueries extends ServerPartyClaimSyncBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Serialize claim snapshot writes of a server for the current transaction. */
  async lockServer(serverId: number): Promise<void> {
    if (!this.isInTransaction()) {
      throw new Error(
        "lockServer must run inside a transaction, pg_advisory_xact_lock releases at statement end otherwise",
      );
    }
    await this.runQuery(
      "lock party claim snapshot",
      `SELECT pg_advisory_xact_lock(hashtextextended('server_party_claim', $1))`,
      [serverId],
    );
  }
}
