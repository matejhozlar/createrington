import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("@/config", () => ({
  default: {
    app: {
      auth: {
        accessToken: { secret: "test-secret-please-do-not-use-in-prod" },
      },
    },
  },
}));

// Module load of mod-jwt.middleware pulls in @/db for requireKnownPlayer.
// The db boundary eagerly pings Postgres on import — mock it away so the
// test never needs a live database.
vi.mock("@/db", () => ({ Q: { player: { find: vi.fn() } } }));

import { verifyModJWT } from "@/app/middleware/mod-jwt.middleware";
import type { Request, Response, NextFunction } from "express";

const TEST_SECRET = "test-secret-please-do-not-use-in-prod";

function makeReq(authHeader: string): Request {
  return {
    headers: { authorization: authHeader },
  } as unknown as Request;
}

function collectNext(): {
  next: NextFunction;
  errors: unknown[];
  called: () => boolean;
} {
  const errors: unknown[] = [];
  let calledNoArg = false;
  const next: NextFunction = (err?: unknown) => {
    if (err) errors.push(err);
    else calledNoArg = true;
  };
  return { next, errors, called: () => calledNoArg };
}

describe("verifyModJWT", () => {
  it("accepts a well-formed mod-audience token", () => {
    const token = jwt.sign({ uuid: "u", name: "n" }, TEST_SECRET, {
      algorithm: "HS256",
      audience: "createrington.mod",
      expiresIn: "60s",
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    verifyModJWT(req, {} as Response, next);

    expect(errors).toHaveLength(0);
    expect(called()).toBe(true);
    expect(req.modAuth?.uuid).toBe("u");
  });

  it("accepts a server-level token without uuid/name claims", () => {
    // Regression guard for #619: PresenceAPI's heartbeat and Forceloads'
    // sync issue server-level tokens that carry only {iat, exp, aud} —
    // tightening assertModJwtPayload to require uuid/name broke both.
    const token = jwt.sign({}, TEST_SECRET, {
      algorithm: "HS256",
      audience: "createrington.mod",
      expiresIn: "60s",
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    verifyModJWT(req, {} as Response, next);

    expect(errors).toHaveLength(0);
    expect(called()).toBe(true);
    expect(req.modAuth?.uuid).toBeUndefined();
    expect(req.modAuth?.name).toBeUndefined();
    expect(req.modAuth?.aud).toBe("createrington.mod");
  });

  it("rejects a mod-audience token whose uuid claim is the wrong type", () => {
    // Partial shape is still a shape failure — a token with uuid set to
    // something non-string must not be admitted just because the claim
    // exists on the payload.
    const token = jwt.sign({ uuid: 42 }, TEST_SECRET, {
      algorithm: "HS256",
      audience: "createrington.mod",
      expiresIn: "60s",
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    verifyModJWT(req, {} as Response, next);

    expect(called()).toBe(false);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/Invalid token/);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects a web-audience token signed with the same secret", () => {
    const token = jwt.sign(
      {
        discordId: "1",
        username: "alice",
        role: "user",
        isAdmin: false,
        minecraftUuid: "u",
        minecraftUsername: "Alice",
      },
      TEST_SECRET,
      {
        algorithm: "HS256",
        audience: "createrington.web",
        expiresIn: "15m",
      },
    );
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    verifyModJWT(req, {} as Response, next);

    expect(called()).toBe(false);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/Invalid token/);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects a token signed with a different secret", () => {
    const token = jwt.sign({ uuid: "u", name: "n" }, "other-secret", {
      algorithm: "HS256",
      audience: "createrington.mod",
      expiresIn: "60s",
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors } = collectNext();

    verifyModJWT(req, {} as Response, next);

    expect(errors).toHaveLength(1);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects when the Authorization header is missing", () => {
    const req = { headers: {} } as unknown as Request;
    const { next, errors } = collectNext();

    verifyModJWT(req, {} as Response, next);

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/authentication required/i);
  });
});
