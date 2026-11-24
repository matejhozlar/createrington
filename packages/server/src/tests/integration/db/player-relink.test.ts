import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Q, playerRepo } from "@/db";
import { sessionService } from "@/services/auth/session/session.service";

const OLD_ID = "779500000000000001";
const NEW_ID = "779500000000000002";
const PLAYER = {
  discordId: OLD_ID,
  minecraftUuid: "dddd0000-0000-4000-8000-000000000001",
  minecraftUsername: "relink_test",
};
const ADMIN_ID = "779500000000000009";

async function cleanup(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: PLAYER.minecraftUuid });
  await Q.donation.deleteAll({ playerDiscordId: { $in: [OLD_ID, NEW_ID] } });
  await Q.waitlist.entry.deleteAll({ discordId: { $in: [OLD_ID, NEW_ID] } });
  await Q.admin.log.action.deleteAll({
    targetPlayerUuid: PLAYER.minecraftUuid,
  });
}

function relink() {
  return playerRepo.adminUpdate(
    { minecraftUuid: PLAYER.minecraftUuid },
    { discordId: NEW_ID },
    ADMIN_ID,
    "admin",
    "lost account",
  );
}

beforeEach(async () => {
  await cleanup();
  await Q.player.create(PLAYER);
});

afterAll(async () => {
  await cleanup();
});

describe("playerRepo.adminUpdate with a new Discord ID", () => {
  it("refuses a refresh token issued to the old account", async () => {
    const rawToken = await sessionService.createSession({
      discordId: OLD_ID,
      username: "old_account",
    });

    await relink();

    expect(await sessionService.rotateToken(rawToken)).toBeNull();
  });

  it("moves the player's Discord-keyed rows to the new ID", async () => {
    await Q.donation.create({
      playerDiscordId: OLD_ID,
      type: "one_time",
      amountCents: 500,
      stripeSessionId: "cs_relink_test",
      status: "completed",
    });
    await Q.waitlist.entry.create({
      discordId: OLD_ID,
      discordUsername: "old_account",
    });

    await relink();

    expect(await Q.donation.count({ playerDiscordId: NEW_ID })).toBe(1);
    expect(await Q.waitlist.entry.count({ discordId: NEW_ID })).toBe(1);
    expect(await Q.waitlist.entry.count({ discordId: OLD_ID })).toBe(0);
  });

  it("keeps a row under the old ID when the new ID already holds its unique key", async () => {
    await Q.waitlist.entry.create({
      discordId: OLD_ID,
      discordUsername: "old_account",
    });
    await Q.waitlist.entry.create({
      discordId: NEW_ID,
      discordUsername: "new_account",
    });

    await relink();

    expect(
      (await Q.waitlist.entry.get({ discordId: NEW_ID })).discordUsername,
    ).toBe("new_account");
    expect(await Q.waitlist.entry.count({ discordId: OLD_ID })).toBe(1);
  });
});
