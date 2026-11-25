import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Q, playerBanRepo } from "@/db";

const PLAYER = "aaaa0000-0000-4000-8000-000000000021";
const DAY = 24 * 60 * 60 * 1000;

async function cleanUp(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: PLAYER });
  await Q.admin.log.action.deleteAll({ targetPlayerUuid: PLAYER });
}

beforeEach(async () => {
  await cleanUp();
  await Q.player.create({
    minecraftUuid: PLAYER,
    minecraftUsername: "ban_race",
    discordId: "778200000000000021",
  });
});

afterAll(cleanUp);

function issueTemporary() {
  return playerBanRepo.issueTemporary(
    { minecraftUuid: PLAYER },
    { reason: "griefing", expiresAt: new Date(Date.now() + DAY) },
    "1",
    "admin",
  );
}

describe("playerBanRepo.issueTemporary", () => {
  it("leaves one active ban when two are issued at the same moment", async () => {
    const results = await Promise.allSettled([
      issueTemporary(),
      issueTemporary(),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    expect(await Q.player.ban.count({ playerMinecraftUuid: PLAYER })).toBe(1);
  });

  it("rejects a second ban while the first is active", async () => {
    await issueTemporary();

    await expect(issueTemporary()).rejects.toThrow(/already banned/);
  });
});
