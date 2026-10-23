import { describe, it, expect, vi, afterEach } from "vitest";
import jwt from "jsonwebtoken";

const { LAUNCHER_SECRET } = vi.hoisted(() => ({
  LAUNCHER_SECRET: "test-launcher-secret-please-do-not-use-in-prod",
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    redis: { url: null },
    app: {
      auth: {
        accessToken: { secret: "unused-web-secret", expiresIn: "15m" },
        launcherAccessToken: { secret: LAUNCHER_SECRET },
      },
    },
  },
}));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConstraintViolationError: class ConstraintViolationError extends Error {},
  QueryError: class QueryError extends Error {},
}));

import { errorHandler } from "@/app/middleware/error-handler";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import {
  JWT_AUDIENCE_LAUNCHER,
  LAUNCHER_ACCESS_TOKEN_TTL_SECONDS,
  launcherJwtService,
} from "@/services/auth/launcher/launcher-jwt.service";
import {
  denyLauncherFamily,
  denyLauncherPlayer,
} from "@/services/auth/launcher/launcher-token-denylist";
import type { NextFunction, Request, Response } from "express";

const PLAYER = {
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
  familyId: "0f6a7b1c-5d4e-4f3a-9b2c-1d0e9f8a7b6c",
};

function makeReq(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
    path: "/api/launcher/auth/me",
    method: "GET",
  } as unknown as Request;
}

async function run(authorization?: string) {
  const req = makeReq(authorization);
  const status = vi.fn();
  const json = vi.fn();
  const res = { status, json } as unknown as Response;
  status.mockReturnValue(res);
  let passed = false;

  await authenticateLauncher(req, res, ((error?: unknown) => {
    if (error) errorHandler(error as Error, req, res, vi.fn());
    else passed = true;
  }) as NextFunction);

  return { req, passed, status, json };
}

function unauthorized(message: string, code: string) {
  return {
    success: false,
    message,
    error: { message, statusCode: 401, code },
  };
}

const INVALID_TOKEN = unauthorized("Invalid launcher token", "INVALID_TOKEN");

describe("authenticateLauncher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets a valid launcher token through and attaches the player and family", async () => {
    const { req, passed, json } = await run(
      `Bearer ${launcherJwtService.generate(PLAYER)}`,
    );

    expect(passed).toBe(true);
    expect(json).not.toHaveBeenCalled();
    expect(req.launcherAuth).toEqual({
      ...PLAYER,
      issuedAt: expect.any(Number),
    });
  });

  it("signs tokens that live exactly the advertised lifetime", () => {
    const decoded = jwt.decode(launcherJwtService.generate(PLAYER)) as {
      iat: number;
      exp: number;
    };

    expect(decoded.exp - decoded.iat).toBe(LAUNCHER_ACCESS_TOKEN_TTL_SECONDS);
  });

  it("answers AUTH_REQUIRED when no token is sent", async () => {
    const { status, json } = await run();

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      unauthorized("Launcher authentication required", "AUTH_REQUIRED"),
    );
  });

  it("answers TOKEN_EXPIRED for an expired launcher token", async () => {
    const expired = jwt.sign(
      { ...PLAYER, exp: Math.floor(Date.now() / 1000) - 10 },
      LAUNCHER_SECRET,
      { algorithm: "HS256", audience: JWT_AUDIENCE_LAUNCHER },
    );

    const { status, json } = await run(`Bearer ${expired}`);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      unauthorized("Launcher token expired", "TOKEN_EXPIRED"),
    );
  });

  it("answers INVALID_TOKEN for a token signed with another secret", async () => {
    const forged = jwt.sign(PLAYER, "some-other-secret-of-sufficient-length", {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: 60,
    });

    const { json } = await run(`Bearer ${forged}`);

    expect(json).toHaveBeenCalledWith(INVALID_TOKEN);
  });

  it("answers INVALID_TOKEN for a launcher-signed token without the player claims", async () => {
    const hollow = jwt.sign({ sub: "x" }, LAUNCHER_SECRET, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: 60,
    });

    const { json } = await run(`Bearer ${hollow}`);

    expect(json).toHaveBeenCalledWith(INVALID_TOKEN);
  });

  it("answers INVALID_TOKEN for a launcher-signed token without a session family", async () => {
    const { familyId: _familyId, ...withoutFamily } = PLAYER;
    const legacy = jwt.sign(withoutFamily, LAUNCHER_SECRET, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: 60,
    });

    const { json } = await run(`Bearer ${legacy}`);

    expect(json).toHaveBeenCalledWith(INVALID_TOKEN);
  });

  it("answers INVALID_TOKEN for a token that is not a JWT", async () => {
    const { json } = await run("Bearer not-a-jwt");

    expect(json).toHaveBeenCalledWith(INVALID_TOKEN);
  });

  describe("after a revocation", () => {
    it("refuses the tokens of a signed-out family at once and keeps the player's other family", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
      const signedOut = launcherJwtService.generate({
        ...PLAYER,
        familyId: "11111111-1111-4111-8111-111111111111",
      });
      const other = launcherJwtService.generate({
        ...PLAYER,
        familyId: "22222222-2222-4222-8222-222222222222",
      });

      await denyLauncherFamily("11111111-1111-4111-8111-111111111111");

      expect((await run(`Bearer ${signedOut}`)).json).toHaveBeenCalledWith(
        INVALID_TOKEN,
      );
      expect((await run(`Bearer ${other}`)).passed).toBe(true);
    });

    it("refuses every token of a banned or removed player at once", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
      const banned = {
        ...PLAYER,
        minecraftUuid: "33333333-3333-4333-8333-333333333333",
      };
      const first = launcherJwtService.generate(banned);
      const second = launcherJwtService.generate({
        ...banned,
        familyId: "44444444-4444-4444-8444-444444444444",
      });

      await denyLauncherPlayer(banned.minecraftUuid);

      expect((await run(`Bearer ${first}`)).json).toHaveBeenCalledWith(
        INVALID_TOKEN,
      );
      expect((await run(`Bearer ${second}`)).json).toHaveBeenCalledWith(
        INVALID_TOKEN,
      );
    });

    it("accepts a token issued after the player was denied", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
      const unbanned = {
        ...PLAYER,
        minecraftUuid: "55555555-5555-4555-8555-555555555555",
      };
      const before = launcherJwtService.generate(unbanned);
      await denyLauncherPlayer(unbanned.minecraftUuid);
      vi.setSystemTime(new Date("2026-10-23T12:00:02Z"));
      const after = launcherJwtService.generate(unbanned);

      expect((await run(`Bearer ${before}`)).json).toHaveBeenCalledWith(
        INVALID_TOKEN,
      );
      expect((await run(`Bearer ${after}`)).passed).toBe(true);
    });

    it("forgets a denial once every token it covered has expired", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
      await denyLauncherFamily("66666666-6666-4666-8666-666666666666");
      vi.setSystemTime(new Date("2026-10-23T12:16:01Z"));
      const token = jwt.sign(
        {
          ...PLAYER,
          familyId: "66666666-6666-4666-8666-666666666666",
          iat: Math.floor(new Date("2026-10-23T12:00:00Z").getTime() / 1000),
        },
        LAUNCHER_SECRET,
        {
          algorithm: "HS256",
          audience: JWT_AUDIENCE_LAUNCHER,
          expiresIn: 30 * 60,
        },
      );

      expect((await run(`Bearer ${token}`)).passed).toBe(true);
    });
  });
});
