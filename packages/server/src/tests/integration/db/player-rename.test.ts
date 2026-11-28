import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { Q, playerRepo } from "@/db";
import { launcherSessionService } from "@/services/auth/launcher/launcher-session.service";
import { isLauncherTokenDenied } from "@/services/auth/launcher/launcher-token-denylist";

const OLD_UUID = "eeee0000-0000-4000-8000-000000000001";
const NEW_UUID = "eeee0000-0000-4000-8000-000000000002";
const PLAYER = {
  discordId: "779600000000000001",
  minecraftUuid: OLD_UUID,
  minecraftUsername: "rename_test",
};
const ADMIN_ID = "779600000000000009";

async function cleanup(): Promise<void> {
  await Q.player.deleteAll({ minecraftUuid: { $in: [OLD_UUID, NEW_UUID] } });
  await Q.discord.guild.member.leave.deleteAll({
    minecraftUuid: { $in: [OLD_UUID, NEW_UUID] },
  });
  await Q.admin.log.action.deleteAll({
    targetPlayerUuid: { $in: [OLD_UUID, NEW_UUID] },
  });
}

function moveToRealAccount() {
  return playerRepo.adminUpdate(
    { minecraftUuid: OLD_UUID },
    { minecraftUsername: "rename_test_real", minecraftUuid: NEW_UUID },
    ADMIN_ID,
    "admin",
    "wrong account at registration",
  );
}

beforeEach(async () => {
  await cleanup();
  await Q.player.create(PLAYER);
  await Q.player.balance.create({ minecraftUuid: OLD_UUID });
});

afterAll(async () => {
  await cleanup();
});

describe("playerRepo.adminUpdate with a new Minecraft UUID", () => {
  it("returns the player under the new UUID and name", async () => {
    const updated = await moveToRealAccount();

    expect(updated).toMatchObject({
      minecraftUuid: NEW_UUID,
      minecraftUsername: "rename_test_real",
      discordId: PLAYER.discordId,
    });
    expect(await Q.player.exists({ minecraftUuid: OLD_UUID })).toBe(false);
  });

  it("refuses a launcher refresh token issued to the old account", async () => {
    const { refreshToken } = await launcherSessionService.createSession({
      minecraftUuid: OLD_UUID,
    });

    await moveToRealAccount();

    expect(
      await launcherSessionService.resolveActiveSession(refreshToken),
    ).toBeNull();
    expect(
      await Q.auth.launcher.session.count({
        playerMinecraftUuid: NEW_UUID,
        revokedAt: null,
      }),
    ).toBe(0);
  });

  it("refuses a launcher access token issued under the old UUID", async () => {
    const { familyId } = await launcherSessionService.createSession({
      minecraftUuid: OLD_UUID,
    });
    const issuedAt = Math.floor(Date.now() / 1000) - 1;

    await moveToRealAccount();

    expect(
      await isLauncherTokenDenied({
        minecraftUuid: OLD_UUID,
        minecraftUsername: PLAYER.minecraftUsername,
        familyId,
        issuedAt,
      }),
    ).toBe(true);
  });

  it("carries rows with a foreign key over to the new UUID", async () => {
    await moveToRealAccount();

    expect(await Q.player.balance.exists({ minecraftUuid: NEW_UUID })).toBe(
      true,
    );
  });

  it("moves rows without a foreign key and the player's audit history", async () => {
    await Q.discord.guild.member.leave.create({
      discordId: PLAYER.discordId,
      minecraftUuid: OLD_UUID,
      minecraftUsername: PLAYER.minecraftUsername,
    });
    await Q.admin.log.action.create({
      adminDiscordId: ADMIN_ID,
      adminUsername: "admin",
      actionType: "update_player",
      targetPlayerUuid: OLD_UUID,
      targetPlayerName: PLAYER.minecraftUsername,
      reason: "earlier edit",
    });

    await moveToRealAccount();

    expect(
      await Q.discord.guild.member.leave.count({ minecraftUuid: NEW_UUID }),
    ).toBe(1);
    expect(await Q.admin.log.action.count({ targetPlayerUuid: OLD_UUID })).toBe(
      0,
    );
    expect(
      await Q.admin.log.action.count({
        targetPlayerUuid: NEW_UUID,
        fieldName: "minecraftUuid",
        oldValue: OLD_UUID,
      }),
    ).toBe(1);
  });
});
