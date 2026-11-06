import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Q } from "@/db";
import {
  replacePartyState,
  type PartyPayload,
} from "@/app/features/mod/parties/parties.service";
import { cleanupTestPool } from "@/tests/helpers/db";

const SERVER_IDENTIFIER = "party-sync-test";
const OWNER = "3F2504E0-4F89-11D3-9A0C-0305E82C3401";
const OFFICER = "3F2504E0-4F89-11D3-9A0C-0305E82C3402";
const MEMBER = "3f2504e0-4f89-11d3-9a0c-0305e82c3403";
const ALLY = "3F2504E0-4F89-11D3-9A0C-0305E82C3404";
const ALPHA = "3F2504E0-4F89-11D3-9A0C-0305E82C3499";
const BETA = "3f2504e0-4f89-11d3-9a0c-0305e82c3498";

let serverId: number;

function party(teamId: string, overrides: Partial<PartyPayload> = {}) {
  return {
    teamId,
    name: "Alpha",
    description: "",
    color: 0xff8800,
    freeToJoin: false,
    members: [
      { uuid: OWNER, rank: "owner" as const, claims: 12, forceloads: 2 },
      { uuid: OFFICER, rank: "officer" as const, claims: 0, forceloads: 0 },
    ],
    allies: [ALLY],
    tagCode: "CRP1:R:ALPH:FF8800:FFFFFF",
    ...overrides,
  } satisfies PartyPayload;
}

async function partyRows() {
  return Q.server.party.findAll({ serverId }, { orderBy: "name" });
}

beforeAll(async () => {
  const existing = await Q.server.find({ identifier: SERVER_IDENTIFIER });
  serverId =
    existing?.id ??
    (
      await Q.server.createAndReturn({
        name: "Party sync test",
        identifier: SERVER_IDENTIFIER,
      })
    ).id;
  await Q.server.party.deleteAll({ serverId });
});

afterAll(async () => {
  await Q.server.deleteAll({ id: serverId });
  await cleanupTestPool();
});

describe("replacePartyState", () => {
  it("stores parties with their members, allies and the tag taken from the design code", async () => {
    await replacePartyState({ serverId, parties: [party(ALPHA)] });

    const [alpha] = await partyRows();
    expect(alpha).toMatchObject({
      teamId: ALPHA.toLowerCase(),
      name: "Alpha",
      color: 0xff8800,
      freeToJoin: false,
      ownerUuid: OWNER.toLowerCase(),
      tagCode: "CRP1:R:ALPH:FF8800:FFFFFF",
      tag: "ALPH",
    });

    const members = await Q.server.party.member.findAll(
      { partyId: alpha.id },
      { orderBy: "minecraftUuid" },
    );
    expect(members).toMatchObject([
      {
        minecraftUuid: OWNER.toLowerCase(),
        rank: "owner",
        claimCount: 12,
        forceloadCount: 2,
      },
      {
        minecraftUuid: OFFICER.toLowerCase(),
        rank: "officer",
        claimCount: 0,
        forceloadCount: 0,
      },
    ]);

    const allies = await Q.server.party.ally.findAll({ partyId: alpha.id });
    expect(allies.map((a) => a.minecraftUuid)).toEqual([ALLY.toLowerCase()]);
  });

  it("keeps the party row across syncs while replacing its members and allies", async () => {
    const [before] = await partyRows();

    await replacePartyState({
      serverId,
      parties: [
        party(ALPHA, {
          name: "Alpha Prime",
          members: [
            { uuid: OWNER, rank: "owner", claims: 13, forceloads: 2 },
            { uuid: MEMBER, rank: "member", claims: null, forceloads: null },
          ],
          allies: [],
        }),
      ],
    });

    const [after] = await partyRows();
    expect(after.id).toBe(before.id);
    expect(after.firstSeenAt).toEqual(before.firstSeenAt);
    expect(after.syncedAt.getTime()).toBeGreaterThan(before.syncedAt.getTime());
    expect(after.name).toBe("Alpha Prime");

    const members = await Q.server.party.member.findAll(
      { partyId: after.id },
      { orderBy: "minecraftUuid" },
    );
    expect(members).toMatchObject([
      { minecraftUuid: OWNER.toLowerCase(), rank: "owner", claimCount: 13 },
      { minecraftUuid: MEMBER, rank: "member", claimCount: null },
    ]);
    expect(await Q.server.party.ally.count({ partyId: after.id })).toBe(0);
  });

  it("removes parties missing from the snapshot and drops an unreadable tag code", async () => {
    await replacePartyState({
      serverId,
      parties: [
        party(BETA, {
          name: "Beta",
          members: [{ uuid: MEMBER, rank: "owner", claims: 1, forceloads: 0 }],
          allies: [ALLY, ALLY.toLowerCase()],
          tagCode: "CRP1:R:TOOLONG:FF8800:FFFFFF",
        }),
      ],
    });

    const rows = await partyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      teamId: BETA,
      name: "Beta",
      tagCode: null,
      tag: null,
    });
    expect(await Q.server.party.ally.count({ partyId: rows[0].id })).toBe(1);
  });

  it("keeps one row per player when a member or ally is listed twice", async () => {
    await replacePartyState({
      serverId,
      parties: [
        party(BETA, {
          members: [
            { uuid: OWNER, rank: "owner", claims: 5, forceloads: 1 },
            {
              uuid: OWNER.toLowerCase(),
              rank: "member",
              claims: null,
              forceloads: null,
            },
            { uuid: MEMBER, rank: "member", claims: 2, forceloads: 0 },
          ],
          allies: [ALLY, ALLY.toLowerCase(), ALLY],
        }),
      ],
    });

    const [beta] = await partyRows();
    const members = await Q.server.party.member.findAll(
      { partyId: beta.id },
      { orderBy: "minecraftUuid" },
    );
    expect(members).toMatchObject([
      { minecraftUuid: OWNER.toLowerCase(), rank: "owner", claimCount: 5 },
      { minecraftUuid: MEMBER, rank: "member", claimCount: 2 },
    ]);
    expect(await Q.server.party.ally.count({ partyId: beta.id })).toBe(1);
  });

  it("clears every party of the server on an empty snapshot", async () => {
    await replacePartyState({ serverId, parties: [] });

    expect(await Q.server.party.count({ serverId })).toBe(0);
    expect(
      await Q.server.party.member.count({
        minecraftUuid: { $in: [OWNER, MEMBER] },
      }),
    ).toBe(0);
  });
});
