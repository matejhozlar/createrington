import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    findPlayer: vi.fn(),
    avatar: vi.fn(),
    render: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    redis: { url: null },
    meta: { links: { website: "http://localhost:3000" } },
    skinApi: { baseUrl: "http://127.0.0.1:8788/internal" },
    servers: { rails: { ip: "10.0.0.1" } },
    app: {
      devClientOrigin: "http://localhost:3000",
      auth: {
        accessToken: { secret: "w".repeat(40), expiresIn: "15m" },
        modAccessToken: { secret: "m".repeat(40) },
        launcherAccessToken: { secret: "l".repeat(40) },
        sso: { corsOrigins: [] },
      },
    },
  },
}));
vi.mock("@/db", () => ({ Q: { player: { find: mocks.findPlayer } } }));
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
vi.mock("@/services/skin-api", () => ({
  getSkinApiClient: () => ({ avatar: mocks.avatar, render: mocks.render }),
  POSE_RENDER_STYLE: "cel",
  MAX_QUALITY_RENDER: { width: 1600, height: 2400 },
}));

import express from "express";
import { errorHandler } from "@/app/middleware/error-handler";
import skinRoutes from "@/app/features/skin/skin.routes";

const UUID = "069a79f4-44e9-4726-a5be-fca90e38aaf5";
const OTHER_UUID = "853c80ef-3c37-49fd-aa49-938b674adae6";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

let server: Server;
let baseUrl: string;

function avatar(
  uuid: string,
  query = "",
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${baseUrl}/api/skin/${uuid}/avatar${query}`, {
    headers,
    redirect: "manual",
  });
}

beforeAll(async () => {
  const app = express();
  app.use("/api/skin", skinRoutes);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findPlayer.mockImplementation(
    async (identifier: { minecraftUuid?: string }) => ({
      minecraftUuid: identifier.minecraftUuid ?? UUID,
    }),
  );
  mocks.avatar.mockResolvedValue(PNG);
});

describe("GET /api/skin/:uuid/avatar", () => {
  it("serves the head of a registered player as a cacheable PNG", async () => {
    const res = await avatar(UUID);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
    expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]{40}"$/);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
    expect(mocks.avatar).toHaveBeenCalledWith({
      source: { uuid: UUID },
      options: { size: 64 },
    });
  });

  it("passes a requested size through to skin-api", async () => {
    const res = await avatar(OTHER_UUID, "?size=128");

    expect(res.status).toBe(200);
    expect(mocks.avatar).toHaveBeenCalledWith({
      source: { uuid: OTHER_UUID },
      options: { size: 128 },
    });
  });

  it("accepts a username and renders the registered player's uuid", async () => {
    const res = await avatar("Steve", "?size=16");

    expect(res.status).toBe(200);
    expect(mocks.findPlayer).toHaveBeenCalledWith({
      minecraftUsername: "Steve",
    });
    expect(mocks.avatar).toHaveBeenCalledWith({
      source: { uuid: UUID },
      options: { size: 16 },
    });
  });

  it("answers 304 when the browser already holds the current head", async () => {
    const first = await avatar(UUID);
    const etag = first.headers.get("etag") as string;

    const res = await avatar(UUID, "", { "If-None-Match": etag });

    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
    expect(mocks.avatar).toHaveBeenCalledTimes(0);
  });

  it("redirects to mc-heads when skin-api fails", async () => {
    mocks.avatar.mockRejectedValue(new Error("skin-api down"));

    const res = await avatar(OTHER_UUID, "?size=32");

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      `https://mc-heads.net/avatar/${OTHER_UUID}/32`,
    );
  });

  it("rejects an unregistered player", async () => {
    mocks.findPlayer.mockResolvedValue(null);

    const res = await avatar(UUID);

    expect(res.status).toBe(404);
    expect(mocks.avatar).not.toHaveBeenCalled();
  });

  it("rejects an identifier that is neither uuid nor username and an out-of-range size", async () => {
    expect((await avatar("not-a-uuid")).status).toBe(400);
    expect((await avatar("123456789012345678")).status).toBe(400);
    expect((await avatar(UUID, "?size=4")).status).toBe(400);
    expect((await avatar(UUID, "?size=huge")).status).toBe(400);
    expect(mocks.avatar).not.toHaveBeenCalled();
  });
});
