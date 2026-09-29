import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { Q } from "@/db";
import { launcherSessionService } from "@/services/auth/launcher/launcher-session.service";
import { refreshTokenService } from "@/services/auth/token/refresh-token.service";

const PLAYER_UUID = "7e57ab1e-0000-4000-8000-000000001507";
const OTHER_UUID = "7e57ab1e-0000-4000-8000-000000001508";

async function removePlayers(): Promise<void> {
  await Q.player.deleteAll({
    minecraftUuid: { $in: [PLAYER_UUID, OTHER_UUID] },
  });
}

async function findSession(rawToken: string) {
  return await Q.auth.launcher.session.find({
    tokenHash: refreshTokenService.hash(rawToken),
  });
}

describe("LauncherSessionService", () => {
  beforeEach(async () => {
    vi.spyOn(refreshTokenService, "getExpiresAt").mockImplementation(
      () => new Date(Date.now() + 30 * 86_400_000),
    );
    await removePlayers();
    await Q.player.create({
      minecraftUuid: PLAYER_UUID,
      minecraftUsername: "launcher_test_1507",
      discordId: "915070000000000001",
    });
    await Q.player.create({
      minecraftUuid: OTHER_UUID,
      minecraftUsername: "launcher_test_1508",
      discordId: "915070000000000002",
    });
  });

  afterAll(async () => {
    await removePlayers();
  });

  it("stores only the hash of the refresh token", async () => {
    const rawToken = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
      ip: "203.0.113.7",
      userAgent: "createrington-launcher/0.1.2",
    });

    const session = await findSession(rawToken);

    expect(rawToken).toMatch(/^[0-9a-f]{80}$/);
    expect(session?.playerMinecraftUuid).toBe(PLAYER_UUID);
    expect(session?.tokenHash).not.toBe(rawToken);
    expect(session?.userAgent).toBe("createrington-launcher/0.1.2");
    expect(session?.revokedAt).toBeNull();
  });

  it("rotates into a new token in the same family and revokes the old one", async () => {
    const first = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });

    const rotated = await launcherSessionService.rotateToken(first);

    expect(rotated?.minecraftUuid).toBe(PLAYER_UUID);
    expect(rotated?.rawToken).not.toBe(first);

    const oldSession = await findSession(first);
    const newSession = await findSession(rotated!.rawToken);
    expect(oldSession?.revokedAt).not.toBeNull();
    expect(newSession?.revokedAt).toBeNull();
    expect(newSession?.familyId).toBe(oldSession?.familyId);
  });

  it("treats a replayed refresh token as theft and revokes the whole family", async () => {
    const first = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });
    const rotated = await launcherSessionService.rotateToken(first);

    const replay = await launcherSessionService.rotateToken(first);

    expect(replay).toBeNull();
    expect((await findSession(rotated!.rawToken))?.revokedAt).not.toBeNull();
    expect(
      await launcherSessionService.rotateToken(rotated!.rawToken),
    ).toBeNull();
  });

  it("rejects an unknown refresh token", async () => {
    expect(await launcherSessionService.rotateToken("f".repeat(80))).toBeNull();
  });

  it("rejects an expired refresh token", async () => {
    const rawToken = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });
    await Q.auth.launcher.session.update(
      { tokenHash: refreshTokenService.hash(rawToken) },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    expect(await launcherSessionService.rotateToken(rawToken)).toBeNull();
  });

  it("revokes a single session on sign-out and leaves the others alone", async () => {
    const first = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });
    const second = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });

    await launcherSessionService.revokeByToken(first);

    expect(await launcherSessionService.rotateToken(first)).toBeNull();
    expect(await launcherSessionService.rotateToken(second)).not.toBeNull();
  });

  it("lists active sessions per player", async () => {
    const kept = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });
    const revoked = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });
    await launcherSessionService.createSession({ minecraftUuid: OTHER_UUID });
    await launcherSessionService.revokeByToken(revoked);

    const sessions = await launcherSessionService.listActive(PLAYER_UUID);

    expect(sessions.map((s) => s.tokenHash)).toEqual([
      refreshTokenService.hash(kept),
    ]);
  });

  it("revokes every session of one player without touching another player", async () => {
    const mine = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });
    await launcherSessionService.createSession({ minecraftUuid: OTHER_UUID });

    await launcherSessionService.revokeAllForPlayer(PLAYER_UUID);

    expect(await launcherSessionService.rotateToken(mine)).toBeNull();
    expect(await launcherSessionService.listActive(PLAYER_UUID)).toEqual([]);
    expect(await launcherSessionService.listActive(OTHER_UUID)).toHaveLength(1);
  });

  it("drops the sessions when the player row is removed", async () => {
    const rawToken = await launcherSessionService.createSession({
      minecraftUuid: PLAYER_UUID,
    });

    await Q.player.delete({ minecraftUuid: PLAYER_UUID });

    expect(await findSession(rawToken)).toBeNull();
  });
});
