import { describe, it, expect, vi, beforeEach } from "vitest";
import { signTestJwt } from "@/tests/helpers/jwt";

vi.mock("@/config", () => ({
  default: {
    app: {
      auth: {
        accessToken: { secret: "test-web-secret-please-do-not-use-in-prod" },
        modAccessToken: { secret: "test-mod-secret-please-do-not-use-in-prod" },
      },
    },
  },
}));

// Module load of mod-jwt.middleware pulls in @/db for requireKnownPlayer.
// The db boundary eagerly pings Postgres on import: mock it away so the
// test never needs a live database. vi.hoisted so the mock fn is shared
// between the factory and the test bodies below.
const { findMock } = vi.hoisted(() => ({ findMock: vi.fn() }));
vi.mock("@/db", () => ({ Q: { player: { find: findMock } } }));

import {
  __resetPlayerExistsCacheForTests,
  requireKnownPlayer,
  verifyModJWT,
} from "@/app/middleware/mod-jwt.middleware";
import type { Request, NextFunction } from "express";
import { UnauthorizedError } from "@/errors";
import { fakeReq, fakeRes } from "@/tests/helpers/http";

const MOD_SECRET = "test-mod-secret-please-do-not-use-in-prod";
const WEB_SECRET = "test-web-secret-please-do-not-use-in-prod";

function makeReq(authHeader: string): Request {
  return fakeReq({ headers: { authorization: authHeader } });
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
  it("accepts a well-formed mod-audience token", async () => {
    const token = await signTestJwt({ uuid: "u", name: "n" }, MOD_SECRET, {
      audience: "createrington.mod",
      expiresInSeconds: 60,
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(errors).toHaveLength(0);
    expect(called()).toBe(true);
    expect(req.modAuth?.uuid).toBe("u");
  });

  it("accepts a server-level token without uuid/name claims", async () => {
    // Regression guard for #619: PresenceAPI's heartbeat and Forceloads'
    // sync issue server-level tokens that carry only {iat, exp, aud}:
    // tightening assertModJwtPayload to require uuid/name broke both.
    const token = await signTestJwt({}, MOD_SECRET, {
      audience: "createrington.mod",
      expiresInSeconds: 60,
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(errors).toHaveLength(0);
    expect(called()).toBe(true);
    expect(req.modAuth?.uuid).toBeUndefined();
    expect(req.modAuth?.name).toBeUndefined();
    expect(req.modAuth?.aud).toBe("createrington.mod");
  });

  it("rejects a mod-audience token whose uuid claim is the wrong type", async () => {
    // Partial shape is still a shape failure: a token with uuid set to
    // something non-string must not be admitted just because the claim
    // exists on the payload.
    const token = await signTestJwt({ uuid: 42 }, MOD_SECRET, {
      audience: "createrington.mod",
      expiresInSeconds: 60,
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(called()).toBe(false);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/Invalid token/);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects a properly-signed web-audience token", async () => {
    const token = await signTestJwt(
      {
        discordId: "1",
        username: "alice",
        role: "user",
        isAdmin: false,
        minecraftUuid: "u",
        minecraftUsername: "Alice",
      },
      WEB_SECRET,
      {
        audience: "createrington.web",
        expiresInSeconds: 900,
      },
    );
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(called()).toBe(false);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/Invalid token/);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signTestJwt({ uuid: "u", name: "n" }, "other-secret", {
      audience: "createrington.mod",
      expiresInSeconds: 60,
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(errors).toHaveLength(1);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects a mod-audience token signed with the web secret (regression: #781)", async () => {
    const token = await signTestJwt({ uuid: "u", name: "n" }, WEB_SECRET, {
      audience: "createrington.mod",
      expiresInSeconds: 60,
    });
    const req = makeReq(`Bearer ${token}`);
    const { next, errors, called } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(called()).toBe(false);
    expect(errors).toHaveLength(1);
    expect(req.modAuth).toBeUndefined();
  });

  it("rejects when the Authorization header is missing", async () => {
    const req = { headers: {} } as unknown as Request;
    const { next, errors } = collectNext();

    await verifyModJWT(req, fakeRes(), next);

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toMatch(/authentication required/i);
  });
});

describe("requireKnownPlayer", () => {
  beforeEach(() => {
    findMock.mockReset();
    __resetPlayerExistsCacheForTests();
  });

  const reqWithUuid = (uuid: string | undefined): Request =>
    ({
      modAuth: uuid ? { uuid, name: "n", aud: "createrington.mod" } : {},
    }) as unknown as Request;

  it("queries the DB on a cold miss and admits a known player", async () => {
    findMock.mockResolvedValueOnce({ minecraftUuid: "u1" });
    const req = reqWithUuid("u1");
    const { next, errors, called } = collectNext();

    await (requireKnownPlayer as (...a: unknown[]) => Promise<void>)(
      req,
      {},
      next,
    );

    expect(findMock).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(0);
    expect(called()).toBe(true);
  });

  it("serves the second request for the same UUID from cache", async () => {
    findMock.mockResolvedValueOnce({ minecraftUuid: "u1" });

    const run = async () => {
      const { next, errors } = collectNext();
      await (requireKnownPlayer as (...a: unknown[]) => Promise<void>)(
        reqWithUuid("u1"),
        {},
        next,
      );
      return errors;
    };

    expect(await run()).toHaveLength(0);
    expect(await run()).toHaveLength(0);

    expect(findMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache unknown players, second miss still hits the DB", async () => {
    findMock.mockResolvedValueOnce(null);
    findMock.mockResolvedValueOnce(null);

    const run = () =>
      (requireKnownPlayer as (...a: unknown[]) => Promise<void>)(
        reqWithUuid("u-missing"),
        {},
        collectNext().next,
      );

    await expect(run()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(run()).rejects.toBeInstanceOf(UnauthorizedError);

    expect(findMock).toHaveBeenCalledTimes(2);
  });

  it("re-queries after the cache TTL expires", async () => {
    vi.useFakeTimers();
    try {
      findMock.mockResolvedValue({ minecraftUuid: "u1" });

      const run = async () => {
        const { next, errors } = collectNext();
        await (requireKnownPlayer as (...a: unknown[]) => Promise<void>)(
          reqWithUuid("u1"),
          {},
          next,
        );
        return errors;
      };

      await run();
      expect(findMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60_001);

      await run();
      expect(findMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects when req.modAuth.uuid is missing", async () => {
    const { next, called } = collectNext();

    await expect(
      (requireKnownPlayer as (...a: unknown[]) => Promise<void>)(
        reqWithUuid(undefined),
        {},
        next,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);

    expect(findMock).not.toHaveBeenCalled();
    expect(called()).toBe(false);
  });
});
