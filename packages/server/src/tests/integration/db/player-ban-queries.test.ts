import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Q } from "@/db";

const EXPIRED = "aaaa0000-0000-4000-8000-000000000011";
const RUNNING = "aaaa0000-0000-4000-8000-000000000012";
const UUIDS = [EXPIRED, RUNNING];
const DAY = 24 * 60 * 60 * 1000;
const BANNER = { bannedByDiscordId: "1", bannedByUsername: "admin" };

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: { $in: UUIDS } });
}

beforeEach(async () => {
  await removePlayers();
  for (const [index, minecraftUuid] of UUIDS.entries()) {
    await Q.player.create({
      minecraftUuid,
      minecraftUsername: `ban_count_${index}`,
      discordId: `77820000000000000${index}`,
    });
  }
  await Q.player.ban.createMany([
    {
      playerMinecraftUuid: EXPIRED,
      banType: "temporary",
      reason: "ran out",
      bannedAt: new Date(Date.now() - 2 * DAY),
      expiresAt: new Date(Date.now() - DAY),
      ...BANNER,
    },
    {
      playerMinecraftUuid: RUNNING,
      banType: "temporary",
      reason: "still on",
      expiresAt: new Date(Date.now() + DAY),
      ...BANNER,
    },
  ]);
});

afterAll(async () => {
  await removePlayers();
});

describe("Q.player.ban.countExpiredBans", () => {
  it("counts exactly the rows getExpiredBans returns", async () => {
    const expired = await Q.player.ban.getExpiredBans();
    const ours = expired.filter((ban) =>
      UUIDS.includes(ban.playerMinecraftUuid),
    );

    expect(ours.map((ban) => ban.playerMinecraftUuid)).toEqual([EXPIRED]);
    expect(await Q.player.ban.countExpiredBans()).toBe(expired.length);
  });
});
