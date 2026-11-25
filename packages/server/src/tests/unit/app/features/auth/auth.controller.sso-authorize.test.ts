import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";

const { SECRET, RETURN_TO, mocks } = vi.hoisted(() => ({
  SECRET: "test-secret-32-chars-min-xxxxxxx",
  RETURN_TO: "https://sandbox.createrington.com/",
  mocks: {
    consumeSsoState: vi.fn(),
    setAccessCookie: vi.fn(),
  },
}));

vi.mock("@/db", () => ({ Q: {} }));
vi.mock("@/db/utils", async () =>
  (await import("@/tests/helpers/mocks/db-utils")).dbUtilsMock(),
);
vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    redis: { url: null },
    app: {
      auth: {
        owner: { discordId: "owner-1" },
        accessToken: { secret: SECRET, expiresIn: "15m" },
        refreshToken: { expiresInDays: 30 },
        cookie: {
          name: "crt_refresh",
          accessName: "crt_access",
          domain: ".createrington.com",
        },
        sso: {
          callbackUrl: "https://createrington.com/api/auth/sso/callback",
          codeExchangeOrigins: [],
        },
      },
    },
  },
}));
vi.mock("@/services/discord/oauth/oauth.service", () => ({
  discordOAuth: {},
  UnverifiedUserError: class extends Error {},
}));
vi.mock("@/services/auth/session/session.service", () => ({
  sessionService: {},
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn() },
}));
vi.mock("@/services/auth/sso/code-store", () => ({ issueSsoCode: vi.fn() }));
vi.mock("@/services/auth/oauth/state-store", () => ({
  OAUTH_STATE_TTL_MS: 600_000,
  consumeOAuthState: vi.fn(),
  issueOAuthState: vi.fn(),
}));
vi.mock("@/services/auth/sso/state-store", () => ({
  issueSsoState: vi.fn(),
  peekSsoState: vi.fn(),
  consumeSsoState: mocks.consumeSsoState,
}));
vi.mock("@/services/auth/sso/return-to", () => ({
  validateReturnTo: (url: string) => url,
}));
vi.mock("@/services/auth/token/access-cookie.service", () => ({
  accessCookieService: {
    isEnabled: () => true,
    extractFromRequest: (req: { cookies?: Record<string, string> }) =>
      req.cookies?.crt_access,
    setCookie: mocks.setAccessCookie,
  },
}));

import { AuthController } from "@/app/features/auth/auth.controller";
import { jwtService } from "@/services/auth/jwt/jwt.service";
import { fakeReq, fakeRes } from "@/tests/helpers/http";

const PAYLOAD: JWTPayload = {
  discordId: "123",
  username: "alice",
  role: AuthRole.USER,
  isAdmin: false,
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
};

function signExpiringIn(seconds: number): string {
  return jwt.sign(PAYLOAD, SECRET, {
    algorithm: "HS256",
    audience: "createrington.web",
    expiresIn: seconds,
  });
}

function expOf(token: string): number {
  return (jwt.decode(token) as { exp: number }).exp;
}

async function authorizeWith(transport: "header" | "cookie", token: string) {
  const req = fakeReq({
    headers: transport === "header" ? { authorization: `Bearer ${token}` } : {},
    cookies: transport === "cookie" ? { crt_access: token } : {},
    body: { state: "state-1", action: "approve" },
    user: jwtService.verify(token),
  });
  const res = fakeRes();
  await AuthController.ssoAuthorize(req, res);
  return res;
}

describe("AuthController.ssoAuthorize", () => {
  beforeEach(() => {
    mocks.consumeSsoState.mockReset();
    mocks.consumeSsoState.mockResolvedValue({ returnTo: RETURN_TO });
    mocks.setAccessCookie.mockReset();
  });

  it.each(["header", "cookie"] as const)(
    "never re-emits a token that outlives the one presented by %s",
    async (transport) => {
      const presented = signExpiringIn(30);

      const res = await authorizeWith(transport, presented);

      expect(mocks.setAccessCookie).toHaveBeenCalledTimes(1);
      const emitted = mocks.setAccessCookie.mock.calls[0][1] as string;
      expect(expOf(emitted)).toBeLessThanOrEqual(expOf(presented));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { redirectUrl: RETURN_TO },
      });
    },
  );

  it("cannot be chained to extend a session past the first token's expiry", async () => {
    const first = signExpiringIn(30);

    await authorizeWith("cookie", first);
    const second = mocks.setAccessCookie.mock.calls[0][1] as string;
    await authorizeWith("cookie", second);
    const third = mocks.setAccessCookie.mock.calls[1][1] as string;

    expect(expOf(third)).toBeLessThanOrEqual(expOf(first));
  });
});
