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
import jwt from "jsonwebtoken";

const { LAUNCHER_SECRET, WEB_SECRET, mocks } = vi.hoisted(() => ({
  LAUNCHER_SECRET: "test-launcher-secret-please-do-not-use-in-prod",
  WEB_SECRET: "test-web-secret-please-do-not-use-in-prod",
  mocks: {
    getLatestPack: vi.fn(),
    listReleases: vi.fn(),
    resolveFiles: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    app: {
      auth: {
        accessToken: { secret: WEB_SECRET, expiresIn: "15m" },
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
vi.mock("@/db", () => ({ Q: { player: { find: vi.fn() } } }));
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
vi.mock("@/services/launcher/pack/launcher-pack.service", () => ({
  launcherPackService: {
    getLatestPack: mocks.getLatestPack,
    listReleases: mocks.listReleases,
    resolveFiles: mocks.resolveFiles,
  },
}));

import express from "express";
import { errorHandler } from "@/app/middleware/error-handler";
import launcherPackRoutes from "@/app/features/launcher/pack/launcher-pack.routes";
import { launcherJwtService } from "@/services/auth/launcher/launcher-jwt.service";

const PACK = {
  version: "1.3.4",
  releasedAt: "2026-09-28T10:00:00.000Z",
  minecraftVersion: "1.21.1",
  modLoader: { id: "neoforge-21.1.249", name: "neoforge", version: "21.1.249" },
  javaMajorVersion: 21,
  zip: {
    fileId: 7100001,
    fileName: "createrington-rails-n-sails-1.3.4.zip",
    url: "https://edge.forgecdn.net/files/7100/1/createrington-rails-n-sails-1.3.4.zip",
    size: 4500000,
    sha1: "d".repeat(40),
  },
};

const RELEASES = {
  releases: [
    PACK,
    {
      ...PACK,
      version: "1.3.3",
      releasedAt: "2026-09-25T10:00:00.000Z",
      zip: {
        ...PACK.zip,
        fileId: 7090001,
        fileName: "createrington-rails-n-sails-1.3.3.zip",
        url: "https://edge.forgecdn.net/files/7090/1/createrington-rails-n-sails-1.3.3.zip",
      },
    },
  ],
};

const RESOLVED = {
  files: [
    {
      projectId: 328085,
      fileId: 7000001,
      fileName: "create-1.21.1-6.0.10.jar",
      size: 123,
      sha1: "e".repeat(40),
      folder: "mods",
      source: "curseforge",
      url: "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
      pageUrl:
        "https://www.curseforge.com/minecraft/mc-mods/create/files/7000001",
    },
  ],
  unresolvedFileIds: [],
};

let server: Server;
let baseUrl: string;
let session: Record<string, string>;

async function getLatest(headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/launcher/pack/latest`, { headers });
}

async function getReleases(headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/launcher/pack/releases`, { headers });
}

async function resolve(body: unknown, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/launcher/pack/files/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  session = {
    Authorization: `Bearer ${launcherJwtService.generate({
      minecraftUuid: "069a79f4-44e9-4726-a5be-fca90e38aaf5",
      minecraftUsername: "Alice_MC",
    })}`,
  };

  const app = express();
  app.use(express.json());
  app.use("/api/launcher/pack", launcherPackRoutes);
  app.use(errorHandler);

  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", () => done());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getLatestPack.mockResolvedValue(PACK);
  mocks.listReleases.mockResolvedValue(RELEASES);
  mocks.resolveFiles.mockResolvedValue(RESOLVED);
});

describe("GET /api/launcher/pack/latest", () => {
  it("gives a launcher session the latest pack", async () => {
    const res = await getLatest(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: PACK });
  });

  it("answers 401 without a launcher session", async () => {
    const res = await getLatest();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
    expect(mocks.getLatestPack).not.toHaveBeenCalled();
  });

  it("answers 401 to a website token", async () => {
    const webToken = jwt.sign({ discordId: "1", role: "admin" }, WEB_SECRET, {
      expiresIn: "15m",
    });

    const res = await getLatest({ Authorization: `Bearer ${webToken}` });

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("INVALID_TOKEN");
    expect(mocks.getLatestPack).not.toHaveBeenCalled();
  });
});

describe("GET /api/launcher/pack/releases", () => {
  it("gives a launcher session the installable releases", async () => {
    const res = await getReleases(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: RELEASES });
  });

  it("answers with an empty list when no release can be installed", async () => {
    mocks.listReleases.mockResolvedValue({ releases: [] });

    const res = await getReleases(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { releases: [] } });
  });

  it("answers 401 without a launcher session", async () => {
    const res = await getReleases();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
    expect(mocks.listReleases).not.toHaveBeenCalled();
  });
});

describe("POST /api/launcher/pack/files/resolve", () => {
  it("resolves the file ids of a launcher session", async () => {
    const res = await resolve({ fileIds: [7000001] }, session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: RESOLVED });
    expect(mocks.resolveFiles).toHaveBeenCalledWith([7000001]);
  });

  it("answers 401 without a launcher session", async () => {
    const res = await resolve({ fileIds: [7000001] });

    expect(res.status).toBe(401);
    expect(mocks.resolveFiles).not.toHaveBeenCalled();
  });

  it.each([
    ["no file ids", {}],
    ["an empty list", { fileIds: [] }],
    ["an id that is not a number", { fileIds: ["7000001"] }],
    ["a negative id", { fileIds: [-1] }],
    ["a fractional id", { fileIds: [1.5] }],
    ["more ids than one request may carry", { fileIds: Array(1001).fill(1) }],
  ])("refuses %s", async (_label, body) => {
    const res = await resolve(body, session);

    expect(res.status).toBe(400);
    expect(mocks.resolveFiles).not.toHaveBeenCalled();
  });
});
