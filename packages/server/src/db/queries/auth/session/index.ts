import type { Pool, PoolClient } from "pg";
import { AuthSessionBaseQueries } from "@/generated/db/auth_session.queries";
import type { AuthSessionRow } from "@createrington/shared/db/auth_session.types";

/**
 * Custom queries for auth_session table
 *
 * - Token lookup by hash (includes revoked/expired for theft detection)
 * - Revocation at multiple scopes: single session, token family, all user sessions
 * - Expired session cleanup
 * - Active session listing for user session management UI
 * - Session insertion with family-based token rotation support
 */
export class AuthSessionQueries extends AuthSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Find a session by token hash (includes revoked/expired for theft detection)
   *
   * @param tokenHash - SHA-256 hash of the refresh token
   * @returns Session row or null if not found
   */
  async findByTokenHash(tokenHash: string): Promise<AuthSessionRow | null> {
    const result = await this.db.query<AuthSessionRow>(
      `SELECT * FROM auth_session WHERE token_hash = $1 LIMIT 1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  /**
   * Revoke a single session by ID
   *
   * @param id - Session row ID
   */
  async revokeById(id: number): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }

  /**
   * Revoke all sessions in a token family (theft detection response)
   *
   * @param familyId - UUID identifying the token rotation family
   */
  async revokeByFamily(familyId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    );
  }

  /**
   * Revoke all sessions for a user (logout-all)
   *
   * @param discordId - Discord user ID
   */
  async revokeAllForUser(discordId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE discord_id = $1 AND revoked_at IS NULL`,
      [discordId],
    );
  }

  /**
   * Revoke a single session by token hash
   *
   * @param tokenHash - SHA-256 hash of the refresh token
   */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  /**
   * Delete expired sessions (cleanup)
   *
   * @returns Number of deleted rows
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM auth_session WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get all active sessions for a user
   *
   * @param discordId - Discord user ID
   * @returns Active (non-revoked, non-expired) sessions ordered by last use
   */
  async getActiveSessions(discordId: string): Promise<AuthSessionRow[]> {
    const result = await this.db.query<AuthSessionRow>(
      `SELECT * FROM auth_session
       WHERE discord_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY last_used_at DESC`,
      [discordId],
    );
    return result.rows;
  }

  /**
   * Insert a new session row
   *
   * @param data - Session data including token hash, user info, and expiry
   * @returns The created session row (includes generated id and family_id)
   */
  async insertSession(data: {
    discordId: string;
    discordUsername: string | null;
    discordAvatar: string | null;
    tokenHash: string;
    familyId: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: Date;
  }): Promise<AuthSessionRow> {
    const result = await this.db.query<AuthSessionRow>(
      `INSERT INTO auth_session
         (discord_id, discord_username, discord_avatar, token_hash, family_id, ip_address, user_agent, expires_at)
       VALUES
         ($1, $2, $3, $4, COALESCE($5::uuid, gen_random_uuid()), $6::inet, $7, $8)
       RETURNING *`,
      [
        data.discordId,
        data.discordUsername,
        data.discordAvatar,
        data.tokenHash,
        data.familyId,
        data.ipAddress,
        data.userAgent,
        data.expiresAt,
      ],
    );
    return result.rows[0];
  }
}
