import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthRole, type JWTPayload } from "@createrington/shared/auth";

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn<(discordId: string) => Promise<boolean>>(),
  issueSsoCode: vi.fn<(payload: unknown) => Promise<string | null>>(),
  createSession: vi.fn<(params: unknown) => Promise<string>>(),
  setRefreshCookie: vi.fn(),
  setAccessCookie: vi.fn(),
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false },
    app: {
      auth: {
        owner: { discordId: "owner-1" },
        accessToken: { secret: "test-secret", expiresIn: "15m" },
      },
    },
  },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: mocks.isAdmin },
}));
vi.mock("@/services/auth/sso/code-store", () => ({
  issueSsoCode: mocks.issueSsoCode,
}));
vi.mock("@/services/auth/session/session.service", () => ({
  sessionService: { createSession: mocks.createSession },
}));
vi.mock("@/services/auth/token/refresh-token.service", () => ({
  refreshTokenService: { setCookie: mocks.setRefreshCookie },
}));
vi.mock("@/services/auth/token/access-cookie.service", () => ({
  accessCookieService: { setCookie: mocks.setAccessCookie },
}));

import type { Request, Response } from "express";
import { TooManyRequestsError } from "@/errors";
import {
  completeLogin,
  deriveRole,
  issueSsoCodeFor,
  toUserDto,
  withLiveAdminStatus,
} from "@/services/auth/login/login";
import { jwtService } from "@/services/auth/jwt/jwt.service";

const USER: JWTPayload = {
  discordId: "user-1",
  username: "alice",
  avatar: "avatar-hash",
  role: AuthRole.USER,
  isAdmin: false,
  minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  minecraftUsername: "Alice_MC",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("deriveRole", () => {
  it("keeps an unverified user unverified whatever the admin flag", () => {
    expect(deriveRole(AuthRole.UNVERIFIED, true)).toBe(AuthRole.UNVERIFIED);
  });

  it("follows the admin flag for a verified user", () => {
    expect(deriveRole(AuthRole.USER, true)).toBe(AuthRole.ADMIN);
    expect(deriveRole(AuthRole.ADMIN, false)).toBe(AuthRole.USER);
  });
});

describe("withLiveAdminStatus", () => {
  it("replaces a stale admin claim and keeps the other token fields", async () => {
    mocks.isAdmin.mockResolvedValue(false);
    const stale = {
      ...USER,
      role: AuthRole.ADMIN,
      isAdmin: true,
      exp: 1700000000,
    };

    const user = await withLiveAdminStatus(stale);

    expect(mocks.isAdmin).toHaveBeenCalledWith("user-1");
    expect(user).toEqual({
      ...stale,
      role: AuthRole.USER,
      isAdmin: false,
    });
  });
});

describe("toUserDto", () => {
  it("keeps only the user fields", () => {
    const dto = toUserDto({ ...USER, exp: 1700000000 } as JWTPayload);
    expect(dto).toEqual(USER);
  });
});

describe("completeLogin", () => {
  it("creates a session and sets both cookies", async () => {
    mocks.createSession.mockResolvedValue("raw-refresh");
    const req = {
      ip: "10.0.0.1",
      headers: { "user-agent": "agent" },
    } as unknown as Request;
    const res = {} as Response;

    const accessToken = await completeLogin(req, res, USER);

    expect(jwtService.verify(accessToken).discordId).toBe("user-1");
    expect(mocks.createSession).toHaveBeenCalledWith({
      discordId: "user-1",
      username: "alice",
      avatar: "avatar-hash",
      ip: "10.0.0.1",
      userAgent: "agent",
    });
    expect(mocks.setRefreshCookie).toHaveBeenCalledWith(res, "raw-refresh");
    expect(mocks.setAccessCookie).toHaveBeenCalledWith(res, accessToken);
  });
});

describe("issueSsoCodeFor", () => {
  it("issues a code carrying membership and ownership", async () => {
    mocks.issueSsoCode.mockResolvedValue("sso-code");

    await expect(
      issueSsoCodeFor({ ...USER, discordId: "owner-1" }),
    ).resolves.toBe("sso-code");
    expect(mocks.issueSsoCode).toHaveBeenCalledWith({
      playerId: USER.minecraftUuid,
      minecraftUsername: "Alice_MC",
      isMember: true,
      isOwner: true,
    });
  });

  it("marks an unverified user as not a member", async () => {
    mocks.issueSsoCode.mockResolvedValue("sso-code");

    await issueSsoCodeFor({ ...USER, role: AuthRole.UNVERIFIED });

    expect(mocks.issueSsoCode).toHaveBeenCalledWith(
      expect.objectContaining({ isMember: false, isOwner: false }),
    );
  });

  it("throws TooManyRequestsError when the code store is full", async () => {
    mocks.issueSsoCode.mockResolvedValue(null);

    await expect(issueSsoCodeFor(USER)).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );
  });
});
