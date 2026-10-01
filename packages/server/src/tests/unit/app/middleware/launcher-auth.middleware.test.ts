import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";

const { LAUNCHER_SECRET } = vi.hoisted(() => ({
  LAUNCHER_SECRET: "test-launcher-secret-please-do-not-use-in-prod",
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
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
import type { NextFunction, Request, Response } from "express";

const PLAYER = {
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
};

function makeReq(authorization?: string): Request {
  return {
    headers: authorization ? { authorization } : {},
    path: "/api/launcher/auth/me",
    method: "GET",
  } as unknown as Request;
}

function run(authorization?: string) {
  const req = makeReq(authorization);
  const status = vi.fn();
  const json = vi.fn();
  const res = { status, json } as unknown as Response;
  status.mockReturnValue(res);
  let passed = false;

  authenticateLauncher(req, res, ((error?: unknown) => {
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

describe("authenticateLauncher", () => {
  it("lets a valid launcher token through and attaches the player", () => {
    const { req, passed, json } = run(
      `Bearer ${launcherJwtService.generate(PLAYER)}`,
    );

    expect(passed).toBe(true);
    expect(json).not.toHaveBeenCalled();
    expect(req.launcherAuth).toEqual(PLAYER);
  });

  it("signs tokens that live exactly the advertised lifetime", () => {
    const decoded = jwt.decode(launcherJwtService.generate(PLAYER)) as {
      iat: number;
      exp: number;
    };

    expect(decoded.exp - decoded.iat).toBe(LAUNCHER_ACCESS_TOKEN_TTL_SECONDS);
  });

  it("answers AUTH_REQUIRED when no token is sent", () => {
    const { status, json } = run();

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      unauthorized("Launcher authentication required", "AUTH_REQUIRED"),
    );
  });

  it("answers TOKEN_EXPIRED for an expired launcher token", () => {
    const expired = jwt.sign(
      { ...PLAYER, exp: Math.floor(Date.now() / 1000) - 10 },
      LAUNCHER_SECRET,
      { algorithm: "HS256", audience: JWT_AUDIENCE_LAUNCHER },
    );

    const { status, json } = run(`Bearer ${expired}`);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      unauthorized("Launcher token expired", "TOKEN_EXPIRED"),
    );
  });

  it("answers INVALID_TOKEN for a token signed with another secret", () => {
    const forged = jwt.sign(PLAYER, "some-other-secret-of-sufficient-length", {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: 60,
    });

    const { json } = run(`Bearer ${forged}`);

    expect(json).toHaveBeenCalledWith(
      unauthorized("Invalid launcher token", "INVALID_TOKEN"),
    );
  });

  it("answers INVALID_TOKEN for a launcher-signed token without the player claims", () => {
    const hollow = jwt.sign({ sub: "x" }, LAUNCHER_SECRET, {
      algorithm: "HS256",
      audience: JWT_AUDIENCE_LAUNCHER,
      expiresIn: 60,
    });

    const { json } = run(`Bearer ${hollow}`);

    expect(json).toHaveBeenCalledWith(
      unauthorized("Invalid launcher token", "INVALID_TOKEN"),
    );
  });

  it("answers INVALID_TOKEN for a token that is not a JWT", () => {
    const { json } = run("Bearer not-a-jwt");

    expect(json).toHaveBeenCalledWith(
      unauthorized("Invalid launcher token", "INVALID_TOKEN"),
    );
  });
});
