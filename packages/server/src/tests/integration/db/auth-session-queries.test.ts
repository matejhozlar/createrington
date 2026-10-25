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

async function insertSession(discordId: string, expiresAt: Date) {
  return Q.auth.session.insertSession({
    discordId,
    discordUsername: null,
    discordAvatar: null,
    tokenHash: `session-test-${discordId}-${Math.random()}`,
    familyId: null,
    ipAddress: null,
    userAgent: null,
    expiresAt,
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
