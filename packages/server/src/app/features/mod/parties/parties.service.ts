import { db } from "@/db";
import type { PartyMemberRank } from "@createrington/shared/party";
import {
  DesignCodeError,
  parseDesignCode,
} from "@createrington/shared/team-tag";

export interface PartyMemberPayload {
  uuid: string;
  rank: PartyMemberRank;
  claims: number | null;
  forceloads: number | null;
}

export interface PartyPayload {
  teamId: string;
  name: string;
  description: string;
  color: number;
  freeToJoin: boolean;
  members: PartyMemberPayload[];
  allies: string[];
  tagCode: string | null;
}

export interface PartySyncPayload {
  serverId: number;
  parties: PartyPayload[];
}

export type ChunkPos = [number, number];

export interface PartyClaimOwnerPayload {
  owner: string;
  claims: ChunkPos[];
  forceloads: ChunkPos[];
}

export interface PartyClaimDimensionPayload {
  dimension: string;
  owners: PartyClaimOwnerPayload[];
}

export interface PartyClaimsPayload {
  serverId: number;
  hash: string;
  dimensions: PartyClaimDimensionPayload[];
}

export interface PartyClaimsResult {
  stored: number;
  changed: boolean;
}

interface ClaimRow {
  serverId: number;
  dimension: string;
  chunkX: number;
  chunkZ: number;
  ownerUuid: string;
  forceloaded: boolean;
}

function flattenClaims(
  serverId: number,
  dimensions: PartyClaimDimensionPayload[],
): ClaimRow[] {
  const rows = new Map<string, ClaimRow>();
  const put = (
    dimension: string,
    ownerUuid: string,
    [chunkX, chunkZ]: ChunkPos,
    forceloaded: boolean,
  ) => {
    const key = `${dimension}|${chunkX}|${chunkZ}`;
    const previous = rows.get(key);
    rows.set(key, {
      serverId,
      dimension,
      chunkX,
      chunkZ,
      ownerUuid,
      forceloaded: forceloaded || (previous?.forceloaded ?? false),
    });
  };

  for (const { dimension, owners } of dimensions) {
    for (const { owner, claims, forceloads } of owners) {
      const ownerUuid = owner.toLowerCase();
      for (const pos of claims) put(dimension, ownerUuid, pos, false);
      for (const pos of forceloads) put(dimension, ownerUuid, pos, true);
    }
  }
  return [...rows.values()];
}

/**
 * Stores the claim snapshot core sent for a server. Snapshot writes of a
 * server are serialized with an advisory lock, so overlapping sends apply
 * one after the other. A snapshot whose hash equals the last stored one only
 * moves synced_at; otherwise the server's chunk rows are replaced and the
 * new hash stored, all in one transaction. Returns the chunk count now
 * stored and whether the rows changed.
 */
export async function replacePartyClaims(
  payload: PartyClaimsPayload,
): Promise<PartyClaimsResult> {
  const { serverId, hash, dimensions } = payload;
  const syncedAt = new Date();

  return db.inTransaction(async (tx) => {
    await tx.server.party.claim.sync.lockServer(serverId);

    const last = await tx.server.party.claim.sync.find({ serverId });
    if (last && last.hash === hash) {
      await tx.server.party.claim.sync.update({ id: last.id }, { syncedAt });
      return { stored: last.chunkCount, changed: false };
    }

    const rows = flattenClaims(serverId, dimensions);
    await tx.server.party.claim.deleteAll({ serverId });
    await tx.server.party.claim.createMany(rows);
    await tx.server.party.claim.sync.upsert(
      { serverId, hash, chunkCount: rows.length, syncedAt },
      "serverId",
      ["hash", "chunkCount", "syncedAt"],
    );
    return { stored: rows.length, changed: true };
  });
}

function resolveTag(
  serverId: number,
  party: PartyPayload,
): { tagCode: string | null; tag: string | null } {
  if (party.tagCode === null) return { tagCode: null, tag: null };
  try {
    return { tagCode: party.tagCode, tag: parseDesignCode(party.tagCode).tag };
  } catch (error) {
    if (!(error instanceof DesignCodeError)) throw error;
    logger.warn(
      `Party sync for server ${serverId}: party ${party.teamId} has an unreadable tag code "${party.tagCode}", stored without a tag (${error.message})`,
    );
    return { tagCode: null, tag: null };
  }
}

function uniqueByUuid<T extends { uuid: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.filter(({ uuid }) => {
    const key = uuid.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Replaces the stored party state of a server with the snapshot core sent.
 *
 * Parties are upserted by (server, team) so their ids and first_seen_at
 * survive syncs while synced_at moves to the current sync, parties missing
 * from the snapshot are deleted (members and allies cascade), then every
 * party's member and ally sets are rewritten. All of it runs in one
 * transaction.
 */
export async function replacePartyState(
  payload: PartySyncPayload,
): Promise<void> {
  const { serverId, parties } = payload;
  const syncedAt = new Date();

  await db.inTransaction(async (tx) => {
    if (parties.length === 0) {
      await tx.server.party.deleteAll({ serverId });
      return;
    }

    await tx.server.party.deleteAll({
      serverId,
      teamId: { $nin: parties.map((party) => party.teamId) },
    });

    await tx.server.party.upsertMany(
      parties.map((party) => ({
        serverId,
        teamId: party.teamId,
        name: party.name,
        description: party.description,
        color: party.color,
        freeToJoin: party.freeToJoin,
        ownerUuid: party.members.find((m) => m.rank === "owner")!.uuid,
        ...resolveTag(serverId, party),
        syncedAt,
      })),
      ["serverId", "teamId"],
      [
        "name",
        "description",
        "color",
        "freeToJoin",
        "ownerUuid",
        "tagCode",
        "tag",
        "syncedAt",
      ],
    );

    const rows = await tx.server.party.findAll({ serverId });
    const partyIdByTeam = new Map(
      rows.map((row) => [row.teamId.toLowerCase(), row.id]),
    );
    const partyIds = rows.map((row) => row.id);

    await tx.server.party.member.deleteAll({ partyId: { $in: partyIds } });
    await tx.server.party.ally.deleteAll({ partyId: { $in: partyIds } });

    await tx.server.party.member.createMany(
      parties.flatMap((party) => {
        const partyId = partyIdByTeam.get(party.teamId.toLowerCase())!;
        return uniqueByUuid(party.members).map((member) => ({
          partyId,
          minecraftUuid: member.uuid,
          rank: member.rank,
          claimCount: member.claims,
          forceloadCount: member.forceloads,
        }));
      }),
    );

    await tx.server.party.ally.createMany(
      parties.flatMap((party) => {
        const partyId = partyIdByTeam.get(party.teamId.toLowerCase())!;
        return uniqueByUuid(party.allies.map((uuid) => ({ uuid }))).map(
          ({ uuid }) => ({ partyId, minecraftUuid: uuid }),
        );
      }),
    );
  });
}
