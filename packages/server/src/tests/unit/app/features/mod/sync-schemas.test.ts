import { describe, it, expect } from "vitest";
import { AllySyncBodySchema } from "@/app/features/mod/allies/allies.schemas";
import { ChunkSyncBodySchema } from "@/app/features/mod/chunks/chunks.schemas";
import { ForceloadSyncBodySchema } from "@/app/features/mod/forceloads/forceloads.schemas";
import {
  HeartbeatBodySchema,
  PresenceBodySchema,
} from "@/app/features/mod/presence/presence.schemas";

const UUID = "11111111-2222-3333-4444-555555555555";
const LONG = "x".repeat(256);

const chunk = { dimension: "minecraft:overworld", x: 0, z: 0, active: true };

function repeat<T>(item: T, count: number): T[] {
  return Array.from({ length: count }, () => item);
}

describe("PresenceBodySchema", () => {
  const joinBody = { minecraftUsername: "steve", uuid: UUID, state: "joined" };

  it("accepts a join event", () => {
    expect(PresenceBodySchema.safeParse(joinBody).success).toBe(true);
  });

  it("rejects a payload missing the username or state", () => {
    expect(PresenceBodySchema.safeParse({ uuid: UUID }).success).toBe(false);
  });

  it("rejects a state other than joined or left", () => {
    expect(
      PresenceBodySchema.safeParse({ ...joinBody, state: "afk" }).success,
    ).toBe(false);
  });

  it("rejects a username that is not a Minecraft username", () => {
    expect(
      PresenceBodySchema.safeParse({ ...joinBody, minecraftUsername: LONG })
        .success,
    ).toBe(false);
  });

  it("drops a playTimeTicks that is negative, fractional or past int4", () => {
    for (const playTimeTicks of [-1, 1.5, 2 ** 31, "100"]) {
      expect(
        PresenceBodySchema.parse({ ...joinBody, playTimeTicks }).playTimeTicks,
      ).toBeUndefined();
    }
  });

  it("drops an overlong logout dimension instead of rejecting the event", () => {
    const parsed = PresenceBodySchema.parse({
      ...joinBody,
      state: "left",
      dimension: LONG,
    });

    expect(parsed.dimension).toBeUndefined();
  });
});

describe("HeartbeatBodySchema", () => {
  it("rejects a players field that is not an array", () => {
    expect(HeartbeatBodySchema.safeParse({ players: "steve" }).success).toBe(
      false,
    );
  });

  it("rejects a roster longer than the cap", () => {
    const player = { uuid: UUID, minecraftUsername: "steve" };

    expect(
      HeartbeatBodySchema.safeParse({ players: repeat(player, 1_001) }).success,
    ).toBe(false);
  });
});

describe("AllySyncBodySchema", () => {
  const body = {
    fakePlayerParty: {
      partyId: UUID,
      ownerUuid: UUID,
      ownerName: "steve",
      members: [{ uuid: UUID }],
    },
    allies: [{ partyId: UUID, alliedAt: 1 }],
    qualified: [{ uuid: UUID, qualifiedAt: 1 }],
    pending: [],
  };

  it("accepts a full ally state", () => {
    expect(AllySyncBodySchema.safeParse(body).success).toBe(true);
  });

  it("rejects an overlong owner name", () => {
    expect(
      AllySyncBodySchema.safeParse({
        ...body,
        fakePlayerParty: { ...body.fakePlayerParty, ownerName: LONG },
      }).success,
    ).toBe(false);
  });

  it("rejects a timestamp that is not valid epoch millis", () => {
    for (const qualifiedAt of [1e20, -1, 1.5]) {
      expect(
        AllySyncBodySchema.safeParse({
          ...body,
          qualified: [{ uuid: UUID, qualifiedAt }],
        }).success,
      ).toBe(false);
    }
    expect(
      AllySyncBodySchema.safeParse({
        ...body,
        allies: [{ partyId: UUID, alliedAt: 1e20 }],
      }).success,
    ).toBe(false);
  });

  it("rejects a list longer than the cap", () => {
    expect(
      AllySyncBodySchema.safeParse({
        ...body,
        pending: repeat({ uuid: UUID, qualifiedAt: 1 }, 10_001),
      }).success,
    ).toBe(false);
  });
});

describe("ChunkSyncBodySchema", () => {
  const claimed = { ...chunk, forceloadable: false };

  it("fills missing party fields with null", () => {
    const parsed = ChunkSyncBodySchema.parse({
      players: [{ playerUuid: UUID, chunks: [claimed] }],
    });

    expect(parsed.players[0]).toMatchObject({
      partyId: null,
      partyName: null,
      partyOptedIn: null,
    });
  });

  it("rejects an overlong dimension or party name", () => {
    expect(
      ChunkSyncBodySchema.safeParse({
        players: [
          { playerUuid: UUID, chunks: [{ ...claimed, dimension: LONG }] },
        ],
      }).success,
    ).toBe(false);
    expect(
      ChunkSyncBodySchema.safeParse({
        players: [{ playerUuid: UUID, partyName: LONG, chunks: [claimed] }],
      }).success,
    ).toBe(false);
  });

  it("rejects a chunk coordinate outside int4", () => {
    expect(
      ChunkSyncBodySchema.safeParse({
        players: [{ playerUuid: UUID, chunks: [{ ...claimed, x: 3e9 }] }],
      }).success,
    ).toBe(false);
  });

  it("rejects more chunks in total than the cap", () => {
    const player = { playerUuid: UUID, chunks: repeat(claimed, 25_001) };

    expect(
      ChunkSyncBodySchema.safeParse({ players: [player, player] }).success,
    ).toBe(false);
  });
});

describe("ForceloadSyncBodySchema", () => {
  const party = {
    partyId: UUID,
    partyName: "Builders",
    memberCount: 1,
    optedIn: true,
    members: [{ uuid: UUID }],
    chunks: [chunk],
  };

  it("accepts a full forceload state", () => {
    expect(
      ForceloadSyncBodySchema.safeParse({
        players: [{ uuid: UUID, chunks: [chunk] }],
        parties: [party],
      }).success,
    ).toBe(true);
  });

  it("rejects a member count or coordinate outside int4", () => {
    expect(
      ForceloadSyncBodySchema.safeParse({
        players: [],
        parties: [{ ...party, memberCount: 2 ** 31 }],
      }).success,
    ).toBe(false);
    expect(
      ForceloadSyncBodySchema.safeParse({
        players: [{ uuid: UUID, chunks: [{ ...chunk, z: -(2 ** 31) - 1 }] }],
        parties: [],
      }).success,
    ).toBe(false);
  });

  it("rejects an overlong party name", () => {
    expect(
      ForceloadSyncBodySchema.safeParse({
        players: [],
        parties: [{ ...party, partyName: LONG }],
      }).success,
    ).toBe(false);
  });

  it("rejects more chunks in total than the cap", () => {
    expect(
      ForceloadSyncBodySchema.safeParse({
        players: [{ uuid: UUID, chunks: repeat(chunk, 25_001) }],
        parties: [{ ...party, chunks: repeat(chunk, 25_001) }],
      }).success,
    ).toBe(false);
  });
});
