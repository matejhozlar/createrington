import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPlayer: vi.fn(),
  isPlayerBanned: vi.fn(),
  verifyMojangJoin: vi.fn(),
  createSession: vi.fn(),
  resolveActiveSession: vi.fn(),
  rotateSession: vi.fn(),
  revokeByToken: vi.fn(),
  revokeAllForPlayer: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: {
    player: {
      find: mocks.findPlayer,
      ban: { isPlayerBanned: mocks.isPlayerBanned },
    },
  },
}));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConstraintViolationError: class ConstraintViolationError extends Error {},
  QueryError: class QueryError extends Error {},
}));
vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    redis: { url: null },
  },
}));
vi.mock("@/utils/mojang-has-joined", () => ({
  verifyMojangJoin: mocks.verifyMojangJoin,
}));
vi.mock("@/services/auth/launcher/launcher-session.service", () => ({
  launcherSessionService: {
    createSession: mocks.createSession,
    resolveActiveSession: mocks.resolveActiveSession,
    rotateSession: mocks.rotateSession,
    revokeByToken: mocks.revokeByToken,
    revokeAllForPlayer: mocks.revokeAllForPlayer,
  },
}));
vi.mock("@/services/auth/launcher/launcher-jwt.service", () => ({
  LAUNCHER_ACCESS_TOKEN_TTL_SECONDS: 900,
  launcherJwtService: { generate: mocks.generate },
}));

import { LauncherAuthController } from "@/app/features/launcher/auth/launcher-auth.controller";
import {
  __resetLauncherChallengesForTests,
  issueLauncherChallenge,
} from "@/services/auth/launcher/challenge-store";
import type { Request, Response } from "express";

const PLAYER = {
  id: 1,
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
  discordId: "123",
};
const REFRESH_TOKEN = "b".repeat(80);
const ROTATED_TOKEN = "d".repeat(80);
const SESSION = {
  id: 7,
  playerMinecraftUuid: PLAYER.minecraftUuid,
  familyId: "0f6a7b1c-5d4e-4f3a-9b2c-1d0e9f8a7b6c",
  revokedAt: null,
};

function makeReq(extra: Partial<Request> = {}): Request {
  return {
    headers: { "user-agent": "createrington-launcher/0.1.2" },
    ip: "203.0.113.7",
    ...extra,
  } as unknown as Request;
}

function makeRes(body: unknown = {}) {
  const json = vi.fn();
  const res = {
    locals: { validated: { params: {}, query: {}, body } },
    json,
  } as unknown as Response;
  return { res, json };
}

async function captureError(promise: Promise<void>) {
  try {
    await promise;
  } catch (error) {
    return error as { statusCode?: number; code?: string };
  }
  throw new Error("Expected the controller to throw");
}

describe("LauncherAuthController", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    __resetLauncherChallengesForTests();
    mocks.generate.mockReturnValue("access-token");
    mocks.createSession.mockResolvedValue(REFRESH_TOKEN);
    mocks.isPlayerBanned.mockResolvedValue(false);
  });

  describe("challenge", () => {
    it("returns a fresh serverId with its lifetime", async () => {
      const { res, json } = makeRes();

      await LauncherAuthController.challenge(makeReq(), res);

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: {
          serverId: expect.stringMatching(/^[0-9a-f]{40}$/),
          expiresIn: 60,
        },
      });
    });
  });

  describe("verify", () => {
    it("issues a launcher session for a whitelisted player, looked up by uuid", async () => {
      const serverId = (await issueLauncherChallenge())!;
      mocks.verifyMojangJoin.mockResolvedValue({
        uuid: PLAYER.minecraftUuid,
        username: "Alice_Renamed",
      });
      mocks.findPlayer.mockResolvedValue(PLAYER);
      const { res, json } = makeRes({ username: "Alice_Renamed", serverId });

      await LauncherAuthController.verify(makeReq(), res);

      expect(mocks.verifyMojangJoin).toHaveBeenCalledWith(
        "Alice_Renamed",
        serverId,
      );
      expect(mocks.findPlayer).toHaveBeenCalledWith({
        minecraftUuid: PLAYER.minecraftUuid,
      });
      expect(mocks.createSession).toHaveBeenCalledWith({
        minecraftUuid: PLAYER.minecraftUuid,
        ip: "203.0.113.7",
        userAgent: "createrington-launcher/0.1.2",
      });
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: {
          accessToken: "access-token",
          expiresIn: 900,
          refreshToken: REFRESH_TOKEN,
          player: {
            minecraftUuid: PLAYER.minecraftUuid,
            minecraftUsername: PLAYER.minecraftUsername,
          },
        },
      });
    });

    it("answers NOT_A_MEMBER for a verified account that is not a player", async () => {
      const serverId = (await issueLauncherChallenge())!;
      mocks.verifyMojangJoin.mockResolvedValue({
        uuid: PLAYER.minecraftUuid,
        username: "Stranger",
      });
      mocks.findPlayer.mockResolvedValue(null);
      const { res } = makeRes({ username: "Stranger", serverId });

      const error = await captureError(
        LauncherAuthController.verify(makeReq(), res),
      );

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("NOT_A_MEMBER");
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("rejects a forged claim that Mojang does not confirm", async () => {
      const serverId = (await issueLauncherChallenge())!;
      mocks.verifyMojangJoin.mockResolvedValue(null);
      const { res } = makeRes({ username: PLAYER.minecraftUsername, serverId });

      const error = await captureError(
        LauncherAuthController.verify(makeReq(), res),
      );

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("INVALID_CLAIM");
      expect(mocks.findPlayer).not.toHaveBeenCalled();
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("rejects a replayed serverId without asking Mojang again", async () => {
      const serverId = (await issueLauncherChallenge())!;
      mocks.verifyMojangJoin.mockResolvedValue({
        uuid: PLAYER.minecraftUuid,
        username: PLAYER.minecraftUsername,
      });
      mocks.findPlayer.mockResolvedValue(PLAYER);
      const body = { username: PLAYER.minecraftUsername, serverId };

      await LauncherAuthController.verify(makeReq(), makeRes(body).res);
      const error = await captureError(
        LauncherAuthController.verify(makeReq(), makeRes(body).res),
      );

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("INVALID_CHALLENGE");
      expect(mocks.verifyMojangJoin).toHaveBeenCalledTimes(1);
      expect(mocks.createSession).toHaveBeenCalledTimes(1);
    });

    it("rejects a serverId the server never issued", async () => {
      const { res } = makeRes({
        username: PLAYER.minecraftUsername,
        serverId: "c".repeat(40),
      });

      const error = await captureError(
        LauncherAuthController.verify(makeReq(), res),
      );

      expect(error.code).toBe("INVALID_CHALLENGE");
      expect(mocks.verifyMojangJoin).not.toHaveBeenCalled();
    });

    it("refuses a banned player", async () => {
      const serverId = (await issueLauncherChallenge())!;
      mocks.verifyMojangJoin.mockResolvedValue({
        uuid: PLAYER.minecraftUuid,
        username: PLAYER.minecraftUsername,
      });
      mocks.findPlayer.mockResolvedValue(PLAYER);
      mocks.isPlayerBanned.mockResolvedValue(true);
      const { res } = makeRes({ username: PLAYER.minecraftUsername, serverId });

      const error = await captureError(
        LauncherAuthController.verify(makeReq(), res),
      );

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("BANNED");
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("reports a Mojang outage as 503 and still burns the challenge", async () => {
      const serverId = (await issueLauncherChallenge())!;
      mocks.verifyMojangJoin.mockRejectedValue(new Error("network down"));
      const body = { username: PLAYER.minecraftUsername, serverId };

      const first = await captureError(
        LauncherAuthController.verify(makeReq(), makeRes(body).res),
      );
      const second = await captureError(
        LauncherAuthController.verify(makeReq(), makeRes(body).res),
      );

      expect(first.statusCode).toBe(503);
      expect(first.code).toBe("MOJANG_UNAVAILABLE");
      expect(second.code).toBe("INVALID_CHALLENGE");
    });
  });

  describe("refresh", () => {
    beforeEach(() => {
      mocks.resolveActiveSession.mockResolvedValue(SESSION);
      mocks.rotateSession.mockResolvedValue(ROTATED_TOKEN);
      mocks.findPlayer.mockResolvedValue(PLAYER);
    });

    it("returns a new token pair after rotation", async () => {
      const { res, json } = makeRes({ refreshToken: REFRESH_TOKEN });

      await LauncherAuthController.refresh(makeReq(), res);

      expect(mocks.resolveActiveSession).toHaveBeenCalledWith(REFRESH_TOKEN);
      expect(mocks.rotateSession).toHaveBeenCalledWith(
        SESSION,
        "203.0.113.7",
        "createrington-launcher/0.1.2",
      );
      expect(json).toHaveBeenCalledWith({
        success: true,
        data: {
          accessToken: "access-token",
          expiresIn: 900,
          refreshToken: ROTATED_TOKEN,
          player: {
            minecraftUuid: PLAYER.minecraftUuid,
            minecraftUsername: PLAYER.minecraftUsername,
          },
        },
      });
    });

    it("rejects an unknown, expired or replayed refresh token", async () => {
      mocks.resolveActiveSession.mockResolvedValue(null);
      const { res } = makeRes({ refreshToken: REFRESH_TOKEN });

      const error = await captureError(
        LauncherAuthController.refresh(makeReq(), res),
      );

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("INVALID_REFRESH_TOKEN");
      expect(mocks.findPlayer).not.toHaveBeenCalled();
      expect(mocks.rotateSession).not.toHaveBeenCalled();
    });

    it("rejects the loser of two concurrent refreshes", async () => {
      mocks.rotateSession.mockResolvedValue(null);
      const { res, json } = makeRes({ refreshToken: REFRESH_TOKEN });

      const error = await captureError(
        LauncherAuthController.refresh(makeReq(), res),
      );

      expect(error.code).toBe("INVALID_REFRESH_TOKEN");
      expect(json).not.toHaveBeenCalled();
    });

    it("cuts off a player who was banned since the last refresh", async () => {
      mocks.isPlayerBanned.mockResolvedValue(true);
      const { res, json } = makeRes({ refreshToken: REFRESH_TOKEN });

      const error = await captureError(
        LauncherAuthController.refresh(makeReq(), res),
      );

      expect(error.code).toBe("BANNED");
      expect(mocks.revokeAllForPlayer).toHaveBeenCalledWith(
        PLAYER.minecraftUuid,
      );
      expect(mocks.rotateSession).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });

    it("cuts off a player who was removed since the last refresh", async () => {
      mocks.findPlayer.mockResolvedValue(null);
      const { res } = makeRes({ refreshToken: REFRESH_TOKEN });

      const error = await captureError(
        LauncherAuthController.refresh(makeReq(), res),
      );

      expect(error.code).toBe("NOT_A_MEMBER");
      expect(mocks.revokeAllForPlayer).toHaveBeenCalledWith(
        PLAYER.minecraftUuid,
      );
      expect(mocks.rotateSession).not.toHaveBeenCalled();
    });

    it("does not consume the refresh token when the player lookup fails unexpectedly", async () => {
      mocks.findPlayer.mockRejectedValue(new Error("connection lost"));
      const { res } = makeRes({ refreshToken: REFRESH_TOKEN });

      await captureError(LauncherAuthController.refresh(makeReq(), res));

      expect(mocks.rotateSession).not.toHaveBeenCalled();
      expect(mocks.revokeAllForPlayer).not.toHaveBeenCalled();
    });

    it("does not consume the refresh token when the ban check fails unexpectedly", async () => {
      mocks.isPlayerBanned.mockRejectedValue(new Error("pool timeout"));
      const { res } = makeRes({ refreshToken: REFRESH_TOKEN });

      await captureError(LauncherAuthController.refresh(makeReq(), res));

      expect(mocks.rotateSession).not.toHaveBeenCalled();
      expect(mocks.revokeAllForPlayer).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revokes the session behind the refresh token", async () => {
      const { res, json } = makeRes({ refreshToken: REFRESH_TOKEN });

      await LauncherAuthController.logout(makeReq(), res);

      expect(mocks.revokeByToken).toHaveBeenCalledWith(REFRESH_TOKEN);
      expect(json).toHaveBeenCalledWith({
        success: true,
        message: "Logged out successfully",
      });
    });
  });

  describe("me", () => {
    it("returns only the player identity from the token", async () => {
      const { res, json } = makeRes();
      const req = makeReq({
        launcherAuth: {
          minecraftUuid: PLAYER.minecraftUuid,
          minecraftUsername: PLAYER.minecraftUsername,
        },
      });

      await LauncherAuthController.me(req, res);

      expect(json).toHaveBeenCalledWith({
        success: true,
        data: {
          player: {
            minecraftUuid: PLAYER.minecraftUuid,
            minecraftUsername: PLAYER.minecraftUsername,
          },
        },
      });
    });
  });
});
