import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";

const { WEB_SECRET, MOD_SECRET, LAUNCHER_SECRET } = vi.hoisted(() => ({
  WEB_SECRET: "test-web-secret-please-do-not-use-in-prod",
  MOD_SECRET: "test-mod-secret-please-do-not-use-in-prod",
  LAUNCHER_SECRET: "test-launcher-secret-please-do-not-use-in-prod",
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    meta: { links: { website: "http://localhost:3000" } },
    app: {
      devClientOrigin: "http://localhost:3000",
      auth: {
        accessToken: { secret: WEB_SECRET, expiresIn: "15m" },
        modAccessToken: { secret: MOD_SECRET },
        launcherAccessToken: { secret: LAUNCHER_SECRET },
        sso: { corsOrigins: [] },
      },
    },
  },
}));

vi.mock("@/db", () => ({ Q: { player: { find: vi.fn() } } }));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConstraintViolationError: class ConstraintViolationError extends Error {},
  QueryError: class QueryError extends Error {},
}));
vi.mock("@/services/discord/oauth/oauth.service", () => ({
  AuthRole: { ADMIN: "admin", USER: "user", UNVERIFIED: "unverified" },
}));
vi.mock("@/services/auth/token/access-cookie.service", () => ({
  accessCookieService: {
    isEnabled: () => false,
    extractFromRequest: () => undefined,
  },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn(async () => false) },
}));

import { authenticate } from "@/app/middleware/auth.middleware";
import { authenticateLauncher } from "@/app/middleware/launcher-auth.middleware";
import { verifyModJWT } from "@/app/middleware/mod-jwt.middleware";
import { UnauthorizedError } from "@/app/middleware/error-handler";
import { jwtService } from "@/services/auth/jwt/jwt.service";
import {
  JWT_AUDIENCE_LAUNCHER,
  launcherJwtService,
} from "@/services/auth/launcher/launcher-jwt.service";
import { AuthRole } from "@createrington/shared/auth";
import type { NextFunction, Request, Response } from "express";

const PLAYER = {
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
};

const WEB_USER = {
  discordId: "123",
  username: "alice",
  role: AuthRole.USER,
  isAdmin: false,
  ...PLAYER,
};

function makeReq(token: string): Request {
  return {
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
  } as unknown as Request;
}

async function run(
  middleware: (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
  req: Request,
): Promise<unknown> {
  let outcome: unknown = "not-called";
  await middleware(req, {} as Response, (err?: unknown) => {
    outcome = err ?? "passed";
  });
  return outcome;
}

describe("LauncherJwtService", () => {
  it("round-trips the Minecraft identity and nothing else", () => {
    const token = launcherJwtService.generate({
      ...WEB_USER,
    });

    expect(launcherJwtService.verify(token)).toEqual(PLAYER);

    const raw = jwt.decode(token) as Record<string, unknown>;
    expect(raw.aud).toBe(JWT_AUDIENCE_LAUNCHER);
    expect(raw.discordId).toBeUndefined();
    expect(raw.isAdmin).toBeUndefined();
    expect(raw.role).toBeUndefined();
  });

  it("rejects an expired launcher token", () => {
    const token = jwt.sign(PLAYER, LAUNCHER_SECRET, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: -10,
    });

    expect(() => launcherJwtService.verify(token)).toThrow("Token expired");
  });

  it("rejects a launcher-audience token signed with the web secret", () => {
    const token = jwt.sign(PLAYER, WEB_SECRET, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: "15m",
    });

    expect(() => launcherJwtService.verify(token)).toThrow("Invalid token");
  });

  it("rejects a web-audience token signed with the launcher secret", () => {
    const token = jwt.sign(PLAYER, LAUNCHER_SECRET, {
      algorithm: "HS256",
      audience: "createrington.web",
      expiresIn: "15m",
    });

    expect(() => launcherJwtService.verify(token)).toThrow("Invalid token");
  });

  it("rejects a token whose payload lacks the Minecraft identity", () => {
    const token = jwt.sign({ minecraftUuid: 42 }, LAUNCHER_SECRET, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: "15m",
    });

    expect(() => launcherJwtService.verify(token)).toThrow(
      "Invalid token payload",
    );
  });
});

describe("token isolation between launcher and website", () => {
  it("accepts a launcher token on a launcher route", async () => {
    const req = makeReq(launcherJwtService.generate(PLAYER));

    expect(await run(authenticateLauncher, req)).toBe("passed");
    expect(req.launcherAuth).toEqual(PLAYER);
  });

  it("rejects a website token on a launcher route", async () => {
    const req = makeReq(jwtService.generate(WEB_USER));

    expect(await run(authenticateLauncher, req)).toBeInstanceOf(
      UnauthorizedError,
    );
    expect(req.launcherAuth).toBeUndefined();
  });

  it("rejects a launcher token on a website route", async () => {
    const req = makeReq(launcherJwtService.generate(PLAYER));

    expect(await run(authenticate, req)).toBeInstanceOf(UnauthorizedError);
    expect(req.user).toBeUndefined();
  });

  it("rejects a launcher token on a mod route", async () => {
    const req = makeReq(launcherJwtService.generate(PLAYER));

    expect(await run(verifyModJWT, req)).toBeInstanceOf(UnauthorizedError);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects a request with no token on a launcher route", async () => {
    const req = { headers: {}, cookies: {} } as unknown as Request;

    expect(await run(authenticateLauncher, req)).toBeInstanceOf(
      UnauthorizedError,
    );
  });
});
