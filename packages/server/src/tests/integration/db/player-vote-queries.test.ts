import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";
import {
  getTestPool,
  truncateTable,
  cleanupTestPool,
} from "@/tests/helpers/db";

const ALICE = "aaaa0000-0000-4000-8000-000000000021";
const BOB = "aaaa0000-0000-4000-8000-000000000022";
const UUIDS = [ALICE, BOB];
const SERVICE = "createmodservers.com";
const EARLY = new Date("2026-10-01T10:00:00Z");
const MID = new Date("2026-10-10T10:00:00Z");
const LATE = new Date("2026-10-20T10:00:00Z");

const votes = Q.player.vote;

function vote(username: string, votedAt: Date, playerMinecraftUuid?: string) {
  return votes.record({
    username,
    serviceName: SERVICE,
    votedAt,
    playerMinecraftUuid,
  });
}

beforeAll(async () => {
  await getTestPool().query("SELECT 1");
});

beforeEach(async () => {
  await truncateTable("player_vote");
  await Q.player.deleteAll({ minecraftUuid: { $in: UUIDS } });
  for (const [index, minecraftUuid] of UUIDS.entries()) {
    await Q.player.create({
      minecraftUuid,
      minecraftUsername: `voter_${index}`,
      discordId: `77830000000000000${index}`,
    });
  }
});

afterAll(async () => {
  await Q.player.deleteAll({ minecraftUuid: { $in: UUIDS } });
  await cleanupTestPool();
});

describe("Q.player.vote.record", () => {
  it("stores a vote without a player when none is given", async () => {
    const stored = await vote("Alice", EARLY);

    expect(stored?.username).toBe("Alice");
    expect(stored?.playerMinecraftUuid).toBeNull();
    expect(stored?.rewardedAt).toBeNull();
  });

  it("returns null for a redelivery of the same vote regardless of username casing", async () => {
    await vote("Alice", EARLY);

    expect(await vote("alice", EARLY)).toBeNull();
    expect(await vote("ALICE", EARLY)).toBeNull();
    expect(await votes.count()).toBe(1);
  });

  it("keeps votes of the same player at different times", async () => {
    await vote("Alice", EARLY);
    await vote("Alice", LATE);

    expect(await votes.count()).toBe(2);
  });
});

describe("Q.player.vote.linkUsername", () => {
  it("links only the unlinked rows of that username", async () => {
    await vote("Alice", EARLY);
    await vote("alice", LATE);
    await vote("Bob", MID, BOB);

    expect(await votes.linkUsername("ALICE", ALICE)).toBe(2);
    expect(await votes.count({ playerMinecraftUuid: ALICE })).toBe(2);
    expect(await votes.count({ playerMinecraftUuid: BOB })).toBe(1);
  });

  it("does not move votes that already belong to a player", async () => {
    await vote("Bob", MID, BOB);

    expect(await votes.linkUsername("Bob", ALICE)).toBe(0);
    expect(await votes.count({ playerMinecraftUuid: BOB })).toBe(1);
  });
});

describe("Q.player.vote.getPending", () => {
  it("lists unrewarded votes oldest first and drops a vote once rewarded", async () => {
    await vote("Alice", LATE, ALICE);
    const first = await vote("Alice", EARLY, ALICE);
    await vote("Bob", MID, BOB);

    const pending = await votes.getPending(ALICE);
    expect(pending.map((v) => v.votedAt)).toEqual([EARLY, LATE]);

    await votes.update({ id: first!.id }, { rewardedAt: new Date() });

    const remaining = await votes.getPending(ALICE);
    expect(remaining.map((v) => v.votedAt)).toEqual([LATE]);
  });
});

describe("Q.player.vote.getTopVoters", () => {
  beforeEach(async () => {
    await vote("Alice", EARLY, ALICE);
    await vote("Alice", LATE, ALICE);
    await vote("Bob", MID, BOB);
    await vote("Unknown", MID);
  });

  it("ranks players by vote count and ignores unlinked votes", async () => {
    const top = await votes.getTopVoters({ limit: 5 });

    expect(top).toEqual([
      { playerMinecraftUuid: ALICE, votes: 2, lastVotedAt: LATE },
      { playerMinecraftUuid: BOB, votes: 1, lastVotedAt: MID },
    ]);
  });

  it("counts only votes cast at or after `since`", async () => {
    const top = await votes.getTopVoters({ limit: 5, since: MID });

    expect(top.map((row) => [row.playerMinecraftUuid, row.votes])).toEqual([
      [BOB, 1],
      [ALICE, 1],
    ]);
  });

  it("breaks a tie in favour of the player who reached the count first", async () => {
    await vote("Bob", EARLY, BOB);

    const top = await votes.getTopVoters({ limit: 5 });

    expect(top.map((row) => row.playerMinecraftUuid)).toEqual([BOB, ALICE]);
  });

  it("honours the limit", async () => {
    expect(await votes.getTopVoters({ limit: 1 })).toHaveLength(1);
  });
});
