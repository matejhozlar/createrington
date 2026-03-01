import type { Pool, PoolClient } from "pg";
import { AuthSessionBaseQueries } from "@/generated/db/auth_session.queries";
import type { AuthSessionRow } from "@createrington/shared/db/auth_session.types";

/**
 * Custom queries for auth_session table
 *
 * Extends the auto-generated base class with session management methods
 * used by the session service for token rotation, theft detection, and cleanup.
 */
export class AuthSessionQueries extends AuthSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Find a session by token hash (includes revoked/expired for theft detection)
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
   */
  async revokeById(id: number): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
      [id],
    );
  }

  /**
   * Revoke all sessions in a token family (theft detection response)
   */
  async revokeByFamily(familyId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
      [familyId],
    );
  }

  /**
   * Revoke all sessions for a user (logout-all)
   */
  async revokeAllForUser(discordId: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE discord_id = $1 AND revoked_at IS NULL`,
      [discordId],
    );
  }

  /**
   * Revoke a single session by token hash
   */
  async revokeByTokenHash(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE auth_session SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  /**
   * Delete expired sessions (cleanup)
   */
  async deleteExpired(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM auth_session WHERE expires_at < NOW()`,
    );
    return result.rowCount ?? 0;
  }

  /**
   * Get all active sessions for a user
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
