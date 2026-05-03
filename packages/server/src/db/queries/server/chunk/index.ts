import type { Pool, PoolClient } from "pg";
import { ServerChunkBaseQueries } from "@/generated/db/server_chunk.queries";
import { escapeLike } from "@/db/utils";

interface PageParams {
  limit: number;
  offset: number;
}

interface ChunksForPlayerFilters {
  dimension?: string | null;
  activeOnly?: boolean;
}

interface SoloPlayerFilters {
  search?: string | null;
  activeOnly?: boolean;
}

export interface ChunkUpsertRow {
  playerUuid: string;
  dimension: string;
  x: number;
  z: number;
  partyId: string | null;
  partyName: string | null;
  partyOptedIn: boolean | null;
  forceloadable: boolean;
  active: boolean;
}

const CHUNK_SYNC_LOCK_NAMESPACE = 0x440c5e10;

export class ServerChunkQueries extends ServerChunkBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Serializes concurrent chunk syncs for the same server within a transaction.
  // Released automatically on COMMIT/ROLLBACK.
  async acquireSyncLock(serverId: number): Promise<void> {
    await this.db.query(`SELECT pg_advisory_xact_lock($1, $2)`, [
      CHUNK_SYNC_LOCK_NAMESPACE,
      serverId,
    ]);
  }

  // Batch-upserts every chunk in one statement via UNNEST.
  // original_player_uuid is sticky: set on INSERT, never overwritten on UPDATE.
  async upsertChunks(
    serverId: number,
    rows: ChunkUpsertRow[],
    syncStart: Date,
  ): Promise<void> {
    if (rows.length === 0) return;

    await this.db.query(
      `INSERT INTO server_chunk (
        server_id, dimension, x, z, player_uuid, original_player_uuid,
        party_id, party_name, party_opted_in, forceloadable, active, last_synced_at
      )
      SELECT
        $1,
        d.dimension, d.x, d.z, d.player_uuid, d.player_uuid,
        d.party_id, d.party_name, d.party_opted_in,
        d.forceloadable, d.active, $2
      FROM UNNEST(
        $3::text[], $4::int[], $5::int[], $6::uuid[],
        $7::uuid[], $8::text[], $9::boolean[],
        $10::boolean[], $11::boolean[]
      ) AS d(
        dimension, x, z, player_uuid,
        party_id, party_name, party_opted_in,
        forceloadable, active
      )
      ON CONFLICT (server_id, dimension, x, z) DO UPDATE SET
        player_uuid = EXCLUDED.player_uuid,
        party_id = EXCLUDED.party_id,
        party_name = EXCLUDED.party_name,
        party_opted_in = EXCLUDED.party_opted_in,
        forceloadable = EXCLUDED.forceloadable,
        active = EXCLUDED.active,
        last_synced_at = EXCLUDED.last_synced_at`,
      [
        serverId,
        syncStart,
        rows.map((r) => r.dimension),
        rows.map((r) => r.x),
        rows.map((r) => r.z),
        rows.map((r) => r.playerUuid),
        rows.map((r) => r.partyId),
        rows.map((r) => r.partyName),
        rows.map((r) => r.partyOptedIn),
        rows.map((r) => r.forceloadable),
        rows.map((r) => r.active),
      ],
    );
  }

  async sweepOrphans(serverId: number, syncStart: Date): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM server_chunk WHERE server_id = $1 AND last_synced_at < $2`,
      [serverId, syncStart],
    );
    return result.rowCount ?? 0;
  }

  async getKpis(serverId: number) {
    const result = await this.db.query<{
      totalChunks: number;
      forceloadableChunks: number;
      activeChunks: number;
      totalParties: number;
      partiesOptedIn: number;
    }>(
      `SELECT
        COUNT(*)::int AS "totalChunks",
        COUNT(*) FILTER (WHERE forceloadable)::int AS "forceloadableChunks",
        COUNT(*) FILTER (WHERE active)::int AS "activeChunks",
        COUNT(DISTINCT party_id)::int AS "totalParties",
        COUNT(DISTINCT party_id) FILTER (WHERE party_opted_in = true)::int AS "partiesOptedIn"
      FROM server_chunk
      WHERE server_id = $1`,
      [serverId],
    );
    return result.rows[0];
  }

  async getPartyAggregates(serverId: number) {
    const result = await this.db.query<{
      partyId: string;
      partyName: string;
      partyOptedIn: boolean | null;
      memberCount: number;
      totalChunks: number;
      forceloadableChunks: number;
      activeChunks: number;
      isAllied: boolean;
      alliedAt: Date | null;
      lastSyncedAt: Date;
    }>(
      `SELECT
        sc.party_id AS "partyId",
        sc.party_name AS "partyName",
        sc.party_opted_in AS "partyOptedIn",
        COUNT(DISTINCT sc.player_uuid)::int AS "memberCount",
        COUNT(*)::int AS "totalChunks",
        COUNT(*) FILTER (WHERE sc.forceloadable)::int AS "forceloadableChunks",
        COUNT(*) FILTER (WHERE sc.active)::int AS "activeChunks",
        ap.party_id IS NOT NULL AS "isAllied",
        ap.allied_at AS "alliedAt",
        MAX(sc.last_synced_at) AS "lastSyncedAt"
      FROM server_chunk sc
      LEFT JOIN server_ally_party ap
        ON ap.party_id = sc.party_id AND ap.server_id = sc.server_id
      WHERE sc.server_id = $1 AND sc.party_id IS NOT NULL
      GROUP BY sc.party_id, sc.party_name, sc.party_opted_in, ap.party_id, ap.allied_at
      ORDER BY "totalChunks" DESC, sc.party_name ASC`,
      [serverId],
    );
    return result.rows;
  }

  async getPlayerChunksByParty(
    serverId: number,
    partyId: string,
    page: PageParams,
  ) {
    const result = await this.db.query<{
      playerUuid: string;
      minecraftUsername: string | null;
      totalChunks: number;
      forceloadableChunks: number;
      activeChunks: number;
    }>(
      `SELECT
        sc.player_uuid AS "playerUuid",
        p.minecraft_username AS "minecraftUsername",
        COUNT(*)::int AS "totalChunks",
        COUNT(*) FILTER (WHERE sc.forceloadable)::int AS "forceloadableChunks",
        COUNT(*) FILTER (WHERE sc.active)::int AS "activeChunks"
      FROM server_chunk sc
      LEFT JOIN player p ON p.minecraft_uuid = sc.player_uuid
      WHERE sc.server_id = $1 AND sc.party_id = $2
      GROUP BY sc.player_uuid, p.minecraft_username
      ORDER BY p.minecraft_username ASC NULLS LAST
      LIMIT $3 OFFSET $4`,
      [serverId, partyId, page.limit, page.offset],
    );
    return result.rows;
  }

  async countPlayersByParty(
    serverId: number,
    partyId: string,
  ): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT sc.player_uuid)::int AS count
       FROM server_chunk sc
       WHERE sc.server_id = $1 AND sc.party_id = $2`,
      [serverId, partyId],
    );
    return result.rows[0]?.count ?? 0;
  }

  async getChunksForPlayer(
    serverId: number,
    playerUuid: string,
    opts: ChunksForPlayerFilters & PageParams,
  ) {
    const params: unknown[] = [serverId, playerUuid];
    const where: string[] = ["sc.server_id = $1", "sc.player_uuid = $2"];

    if (opts.dimension) {
      params.push(opts.dimension);
      where.push(`sc.dimension = $${params.length}`);
    }
    if (opts.activeOnly) {
      where.push("sc.active = true");
    }

    params.push(opts.limit);
    const limitIdx = params.length;
    params.push(opts.offset);
    const offsetIdx = params.length;

    const result = await this.db.query<{
      id: number;
      dimension: string;
      x: number;
      z: number;
      forceloadable: boolean;
      active: boolean;
      partyId: string | null;
      partyName: string | null;
    }>(
      `SELECT
        sc.id,
        sc.dimension,
        sc.x,
        sc.z,
        sc.forceloadable,
        sc.active,
        sc.party_id AS "partyId",
        sc.party_name AS "partyName"
      FROM server_chunk sc
      WHERE ${where.join(" AND ")}
      ORDER BY sc.dimension, sc.x, sc.z
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return result.rows;
  }

  async countChunksForPlayer(
    serverId: number,
    playerUuid: string,
    filters: ChunksForPlayerFilters,
  ): Promise<number> {
    const params: unknown[] = [serverId, playerUuid];
    const where: string[] = ["sc.server_id = $1", "sc.player_uuid = $2"];

    if (filters.dimension) {
      params.push(filters.dimension);
      where.push(`sc.dimension = $${params.length}`);
    }
    if (filters.activeOnly) {
      where.push("sc.active = true");
    }

    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM server_chunk sc
       WHERE ${where.join(" AND ")}`,
      params,
    );
    return result.rows[0]?.count ?? 0;
  }

  async getSoloPlayerAggregates(
    serverId: number,
    opts: SoloPlayerFilters & PageParams,
  ) {
    const params: unknown[] = [serverId];
    const searchClause = opts.search
      ? (() => {
          params.push(`%${escapeLike(opts.search!)}%`);
          const idx = params.length;
          return `AND (p.minecraft_username ILIKE $${idx} OR sc.player_uuid::text ILIKE $${idx})`;
        })()
      : "";

    params.push(opts.limit);
    const limitIdx = params.length;
    params.push(opts.offset);
    const offsetIdx = params.length;

    const havingClause = opts.activeOnly
      ? "HAVING COUNT(*) FILTER (WHERE sc.active) > 0"
      : "";

    const result = await this.db.query<{
      playerUuid: string;
      minecraftUsername: string | null;
      totalChunks: number;
      forceloadableChunks: number;
      activeChunks: number;
      lastSyncedAt: Date;
    }>(
      `SELECT
        sc.player_uuid AS "playerUuid",
        p.minecraft_username AS "minecraftUsername",
        COUNT(*)::int AS "totalChunks",
        COUNT(*) FILTER (WHERE sc.forceloadable)::int AS "forceloadableChunks",
        COUNT(*) FILTER (WHERE sc.active)::int AS "activeChunks",
        MAX(sc.last_synced_at) AS "lastSyncedAt"
      FROM server_chunk sc
      LEFT JOIN player p ON p.minecraft_uuid = sc.player_uuid
      WHERE sc.server_id = $1 AND sc.party_id IS NULL ${searchClause}
      GROUP BY sc.player_uuid, p.minecraft_username
      ${havingClause}
      ORDER BY "totalChunks" DESC, p.minecraft_username ASC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );
    return result.rows;
  }

  async countSoloPlayers(
    serverId: number,
    filters: SoloPlayerFilters,
  ): Promise<number> {
    const params: unknown[] = [serverId];
    const searchClause = filters.search
      ? (() => {
          params.push(`%${escapeLike(filters.search!)}%`);
          const idx = params.length;
          return `AND (p.minecraft_username ILIKE $${idx} OR sc.player_uuid::text ILIKE $${idx})`;
        })()
      : "";

    // activeOnly forces us to aggregate per-player and count rows where the
    // active-chunks aggregate is > 0; counting distinct player_uuid alone would
    // ignore the filter.
    const aggregateFilter = filters.activeOnly
      ? `AND EXISTS (
           SELECT 1 FROM server_chunk sc2
           WHERE sc2.server_id = sc.server_id
             AND sc2.player_uuid = sc.player_uuid
             AND sc2.party_id IS NULL
             AND sc2.active = true
         )`
      : "";

    const result = await this.db.query<{ count: number }>(
      `SELECT COUNT(DISTINCT sc.player_uuid)::int AS count
       FROM server_chunk sc
       LEFT JOIN player p ON p.minecraft_uuid = sc.player_uuid
       WHERE sc.server_id = $1 AND sc.party_id IS NULL ${searchClause} ${aggregateFilter}`,
      params,
    );
    return result.rows[0]?.count ?? 0;
  }
}
