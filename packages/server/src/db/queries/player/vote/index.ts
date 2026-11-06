import type { Pool, PoolClient } from "pg";
import { PlayerVoteBaseQueries } from "@/generated/db/player_vote.queries";
import type {
  PlayerVote,
  PlayerVoteCreate,
  PlayerVoteRow,
} from "@createrington/shared/db";

export interface TopVoter {
  playerMinecraftUuid: string;
  minecraftUsername: string;
  votes: number;
  lastVotedAt: Date;
}

export interface VoteStats {
  total: number;
  last30Days: number;
  last24Hours: number;
  voters: number;
  unlinked: number;
  pending: number;
  pendingPlayers: number;
  firstVotedAt: Date | null;
  lastVotedAt: Date | null;
}

/**
 * Custom queries for player_vote table
 *
 * - Idempotent recording of votes from the Votifier listener
 * - Payout queue reads for a player (votes not yet rewarded)
 * - Linking unresolved votes to a player once the username registers
 * - Top voters ranking for the leaderboard and the top role
 * - Totals for the admin votes page
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

  /** Players with at least one vote that has not been rewarded yet. */
  async getPendingPlayerUuids(): Promise<string[]> {
    const result = await this.runQuery<{ player_minecraft_uuid: string }>(
      "get players with pending votes",
      `SELECT DISTINCT player_minecraft_uuid
       FROM ${this.table}
       WHERE player_minecraft_uuid IS NOT NULL AND rewarded_at IS NULL`,
    );
    return result.rows.map((row) => row.player_minecraft_uuid);
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
    let where = "v.player_minecraft_uuid IS NOT NULL";
    if (options.since) {
      params.push(options.since);
      where += ` AND v.voted_at >= $${params.length}`;
    }

    const result = await this.runQuery<{
      player_minecraft_uuid: string;
      minecraft_username: string;
      votes: number;
      last_voted_at: Date;
    }>(
      "get top voters",
      `SELECT
         v.player_minecraft_uuid,
         p.minecraft_username,
         COUNT(*)::integer AS votes,
         MAX(v.voted_at) AS last_voted_at
       FROM ${this.table} v
       JOIN player p ON p.minecraft_uuid = v.player_minecraft_uuid
       WHERE ${where}
       GROUP BY v.player_minecraft_uuid, p.minecraft_username
       ORDER BY votes DESC, last_voted_at ASC
       LIMIT $1`,
      params,
    );
    return result.rows.map((row) => ({
      playerMinecraftUuid: row.player_minecraft_uuid,
      minecraftUsername: row.minecraft_username,
      votes: row.votes,
      lastVotedAt: row.last_voted_at,
    }));
  }

  /** Vote totals across the whole table. */
  async getStats(): Promise<VoteStats> {
    const row = await this.runQueryForRow<{
      total: number;
      last_30_days: number;
      last_24_hours: number;
      voters: number;
      unlinked: number;
      pending: number;
      pending_players: number;
      first_voted_at: Date | null;
      last_voted_at: Date | null;
    }>(
      "get vote stats",
      `SELECT
         COUNT(*)::integer AS total,
         COUNT(*) FILTER (WHERE voted_at >= NOW() - INTERVAL '30 days')::integer AS last_30_days,
         COUNT(*) FILTER (WHERE voted_at >= NOW() - INTERVAL '24 hours')::integer AS last_24_hours,
         COUNT(DISTINCT player_minecraft_uuid)::integer AS voters,
         COUNT(*) FILTER (WHERE player_minecraft_uuid IS NULL AND rewarded_at IS NULL)::integer AS unlinked,
         COUNT(*) FILTER (WHERE rewarded_at IS NULL AND player_minecraft_uuid IS NOT NULL)::integer AS pending,
         COUNT(DISTINCT player_minecraft_uuid) FILTER (WHERE rewarded_at IS NULL)::integer AS pending_players,
         MIN(voted_at) AS first_voted_at,
         MAX(voted_at) AS last_voted_at
       FROM ${this.table}`,
    );
    return {
      total: row.total,
      last30Days: row.last_30_days,
      last24Hours: row.last_24_hours,
      voters: row.voters,
      unlinked: row.unlinked,
      pending: row.pending,
      pendingPlayers: row.pending_players,
      firstVotedAt: row.first_voted_at,
      lastVotedAt: row.last_voted_at,
    };
  }
}
