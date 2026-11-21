import type { Pool, PoolClient } from "pg";
import { AuthSessionBaseQueries } from "@/generated/db/auth_session.queries";
import type { AuthSession } from "@createrington/shared/db/auth_session.types";

/**
 * Custom queries for auth_session table
 *
 * - Conditional revocation that reports whether this call revoked the row
 * - Active session listing for the session management UI
 */
export class AuthSessionQueries extends AuthSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /** Revoke a single session by id; false when it was already revoked. */
  async revokeById(id: number): Promise<boolean> {
    const result = await this.runQuery(
      "revoke auth session",
      `UPDATE ${this.table} SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Revoke one of a user's live sessions; false when it is not theirs, already revoked or expired. */
  async revokeOwnedById(id: number, discordId: string): Promise<boolean> {
    const result = await this.runQuery(
      "revoke owned auth session",
      `UPDATE ${this.table}
       SET revoked_at = NOW()
       WHERE id = $1 AND discord_id = $2
         AND revoked_at IS NULL AND expires_at > NOW()`,
      [id, discordId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** A user's non-revoked, non-expired sessions, most recently used first. */
  async getActiveSessions(discordId: string): Promise<AuthSession[]> {
    return this.findAll(
      {
        discordId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      },
      { orderBy: "lastUsedAt", orderDirection: "desc" },
    );
  }
}
