import { db } from "@/db";

export interface AllyFakeMemberPayload {
  uuid: string;
}

export interface AllyFakePartyPayload {
  partyId: string;
  ownerUuid: string;
  ownerName: string;
  members: AllyFakeMemberPayload[];
}

export interface AlliedPartyPayload {
  partyId: string;
  alliedAt: number;
}

export interface QualifiedPlayerPayload {
  uuid: string;
  qualifiedAt: number;
}

export interface AllySyncPayload {
  serverId: number;
  fakePlayerParty: AllyFakePartyPayload;
  allies: AlliedPartyPayload[];
  qualified: QualifiedPlayerPayload[];
  pending: QualifiedPlayerPayload[];
}

/**
 * Replaces the full ally state for a server.
 *
 * Within a single transaction this deletes existing rows for the server
 * (fake-party members cascade), then inserts the new state. The mod always
 * sends a complete snapshot, so a full replace is correct.
 */
export async function replaceAllyState(
  payload: AllySyncPayload,
): Promise<void> {
  const { serverId, fakePlayerParty, allies, qualified, pending } = payload;

  await db.inTransaction(async (tx) => {
    await tx.server.ally.fake.party.deleteAll({ serverId });
    await tx.server.ally.party.deleteAll({ serverId });
    await tx.server.ally.qualified.player.deleteAll({ serverId });

    const fakePartyRow = await tx.server.ally.fake.party.createAndReturn({
      serverId,
      partyId: fakePlayerParty.partyId,
      ownerUuid: fakePlayerParty.ownerUuid,
      ownerName: fakePlayerParty.ownerName,
    });

    await tx.server.ally.fake.party.member.createMany(
      fakePlayerParty.members.map((m) => ({
        fakePartyId: fakePartyRow.id,
        playerUuid: m.uuid,
      })),
    );

    await tx.server.ally.party.createMany(
      allies.map((a) => ({
        serverId,
        partyId: a.partyId,
        alliedAt: new Date(a.alliedAt),
      })),
    );

    await tx.server.ally.qualified.player.createMany([
      ...qualified.map((q) => ({
        serverId,
        playerUuid: q.uuid,
        qualifiedAt: new Date(q.qualifiedAt),
        isPending: false,
      })),
      ...pending.map((p) => ({
        serverId,
        playerUuid: p.uuid,
        qualifiedAt: new Date(p.qualifiedAt),
        isPending: true,
      })),
    ]);
  });
}
