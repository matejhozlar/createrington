import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const OWNER = "779400000000000001";
const OTHER = "779400000000000002";
const PLAYERS = [
  { discordId: OWNER, minecraftUuid: "cccc0000-0000-4000-8000-000000000001" },
  { discordId: OTHER, minecraftUuid: "cccc0000-0000-4000-8000-000000000002" },
];
const DAY = 24 * 60 * 60 * 1000;

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({
    discordId: { $in: PLAYERS.map((player) => player.discordId) },
  });
}

async function insertSession(
  discordId: string,
  expiresAt: Date,
  lastUsedAt = new Date(),
) {
  return Q.auth.session.createAndReturn({
    discordId,
    tokenHash: `session-test-${discordId}-${Math.random()}`,
    expiresAt,
    lastUsedAt,
  });
}

beforeEach(async () => {
  await removePlayers();
  for (const [index, player] of PLAYERS.entries()) {
    await Q.player.create({
      ...player,
      minecraftUsername: `session_test_${index}`,
    });
  }
});

afterAll(async () => {
  await removePlayers();
});

describe("Q.auth.session.revokeOwnedById", () => {
  it("revokes only a live session that belongs to the caller, once", async () => {
    const live = await insertSession(OWNER, new Date(Date.now() + DAY));
    const expired = await insertSession(OWNER, new Date(Date.now() - DAY));
    const foreign = await insertSession(OTHER, new Date(Date.now() + DAY));

    expect(await Q.auth.session.revokeOwnedById(foreign.id, OWNER)).toBe(false);
    expect(await Q.auth.session.revokeOwnedById(expired.id, OWNER)).toBe(false);
    expect(await Q.auth.session.revokeOwnedById(live.id, OWNER)).toBe(true);
    expect(await Q.auth.session.revokeOwnedById(live.id, OWNER)).toBe(false);

    expect(
      (await Q.auth.session.get({ id: live.id })).revokedAt,
    ).not.toBeNull();
    expect((await Q.auth.session.get({ id: foreign.id })).revokedAt).toBeNull();
  });
});

describe("Q.auth.session.getActiveSessions", () => {
  it("lists the user's live sessions, most recently used first", async () => {
    const older = await insertSession(
      OWNER,
      new Date(Date.now() + DAY),
      new Date(Date.now() - DAY),
    );
    const newer = await insertSession(OWNER, new Date(Date.now() + DAY));
    const revoked = await insertSession(OWNER, new Date(Date.now() + DAY));
    await Q.auth.session.revokeById(revoked.id);
    await insertSession(OWNER, new Date(Date.now() - DAY));
    await insertSession(OTHER, new Date(Date.now() + DAY));

    const sessions = await Q.auth.session.getActiveSessions(OWNER);

    expect(sessions.map((session) => session.id)).toEqual([newer.id, older.id]);
    expect(sessions[0].familyId).toEqual(expect.any(String));
  });
});
