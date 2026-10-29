import { describe, it, expect } from "vitest";
import { PartySyncBodySchema } from "@/app/features/mod/parties/parties.schemas";
import {
  HeartbeatBodySchema,
  PresenceBodySchema,
} from "@/app/features/mod/presence/presence.schemas";

const UUID = "11111111-2222-3333-4444-555555555555";
const LONG = "x".repeat(256);

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

describe("PartySyncBodySchema", () => {
  const OTHER = "11111111-2222-3333-4444-666666666666";
  const owner = { uuid: UUID, rank: "owner", claims: 3, forceloads: 0 };
  const party = {
    teamId: UUID,
    name: "Alpha",
    description: "",
    color: 0xff8800,
    freeToJoin: false,
    members: [
      owner,
      { uuid: OTHER, rank: "member", claims: null, forceloads: null },
    ],
    allies: [OTHER],
    tagCode: null,
  };

  it("accepts a snapshot with null chunk counters and a tag code", () => {
    expect(
      PartySyncBodySchema.safeParse({
        parties: [{ ...party, tagCode: "CRP1:R:ALPH:FF8800:FFFFFF" }],
      }).success,
    ).toBe(true);
    expect(PartySyncBodySchema.safeParse({ parties: [] }).success).toBe(true);
  });

  it("rejects a party without exactly one owner", () => {
    expect(
      PartySyncBodySchema.safeParse({
        parties: [{ ...party, members: [{ ...owner, rank: "officer" }] }],
      }).success,
    ).toBe(false);
    expect(
      PartySyncBodySchema.safeParse({
        parties: [{ ...party, members: [owner, { ...owner, uuid: OTHER }] }],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown rank or a negative chunk counter", () => {
    expect(
      PartySyncBodySchema.safeParse({
        parties: [
          {
            ...party,
            members: [owner, { ...owner, uuid: OTHER, rank: "ally" }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      PartySyncBodySchema.safeParse({
        parties: [{ ...party, members: [{ ...owner, claims: -1 }] }],
      }).success,
    ).toBe(false);
  });

  it("rejects an overlong name, description or tag code", () => {
    for (const bad of [
      { name: LONG },
      { description: "x".repeat(1_001) },
      { tagCode: LONG },
    ]) {
      expect(
        PartySyncBodySchema.safeParse({ parties: [{ ...party, ...bad }] })
          .success,
      ).toBe(false);
    }
  });

  it("rejects lists longer than the caps", () => {
    expect(
      PartySyncBodySchema.safeParse({ parties: repeat(party, 2_001) }).success,
    ).toBe(false);
    expect(
      PartySyncBodySchema.safeParse({
        parties: [{ ...party, allies: repeat(OTHER, 201) }],
      }).success,
    ).toBe(false);
  });
});
