import type { Pool, PoolClient } from "pg";
import { PlayerVoteBaseQueries } from "@/generated/db/player_vote.queries";
import type {
  PlayerVote,
  PlayerVoteCreate,
  PlayerVoteRow,
} from "@createrington/shared/db";

export interface TopVoter {
  playerMinecraftUuid: string;
  votes: number;
  lastVotedAt: Date;
}

/**
 * Custom queries for player_vote table
 *
 * - Idempotent recording of votes from the Votifier listener
 * - Payout queue reads for a player (votes not yet rewarded)
 * - Linking unresolved votes to a player once the username registers
 * - Top voters ranking for the leaderboard and the top role
 */
export class PlayerVoteQueries extends PlayerVoteBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Inserts a vote and returns it, or returns null when the same service
   * already delivered that vote (same username and timestamp).
   */
  async record(data: PlayerVoteCreate): Promise<PlayerVote | null> {
    const mappings = this.getCreateMapping(data);
    const columns = mappings.map((m) => m.column).join(", ");
    const placeholders = mappings.map((_, i) => `$${i + 1}`).join(", ");

    const result = await this.runQuery<PlayerVoteRow>(
      "record player vote",
      `INSERT INTO ${this.table} (${columns})
       VALUES (${placeholders})
       ON CONFLICT (service_name, lower(username), voted_at) DO NOTHING
       RETURNING *`,
      mappings.map((m) => m.value),
    );
    return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
  }

  /** Votes of a player that have not been rewarded yet, oldest first. */
  async getPending(playerMinecraftUuid: string): Promise<PlayerVote[]> {
    return this.findAll(
      { playerMinecraftUuid, rewardedAt: { $exists: false } },
      { orderBy: "votedAt", orderDirection: "asc" },
    );
  }

  /**
   * Attaches every unlinked vote cast under `username` to the player and
   * returns how many rows were linked.
   */
  async linkUsername(
    username: string,
    playerMinecraftUuid: string,
  ): Promise<number> {
    const result = await this.runQuery(
      "link player votes by username",
      `UPDATE ${this.table}
       SET player_minecraft_uuid = $1
       WHERE player_minecraft_uuid IS NULL AND lower(username) = lower($2)`,
      [playerMinecraftUuid, username],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Players ranked by vote count, most votes first and earliest latest
   * vote breaking ties. `since` limits the window to votes cast at or
   * after that moment; omit it for all-time.
   */
  async getTopVoters(options: {
    limit: number;
    since?: Date;
  }): Promise<TopVoter[]> {
    const params: unknown[] = [options.limit];
    let where = "player_minecraft_uuid IS NOT NULL";
    if (options.since) {
      params.push(options.since);
      where += ` AND voted_at >= $${params.length}`;
    }

    const result = await this.runQuery<{
      player_minecraft_uuid: string;
      votes: number;
      last_voted_at: Date;
    }>(
      "get top voters",
      `SELECT
         player_minecraft_uuid,
         COUNT(*)::integer AS votes,
         MAX(voted_at) AS last_voted_at
       FROM ${this.table}
       WHERE ${where}
       GROUP BY player_minecraft_uuid
       ORDER BY votes DESC, last_voted_at ASC
       LIMIT $1`,
      params,
    );
    return result.rows.map((row) => ({
      playerMinecraftUuid: row.player_minecraft_uuid,
      votes: row.votes,
      lastVotedAt: row.last_voted_at,
    }));
  }
}
