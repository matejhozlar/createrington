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
import type { KeyValueStore } from "@/services/key-value-store";

const { LAUNCHER_SECRET, WEB_SECRET, mocks, cache } = vi.hoisted(() => ({
  cache: { current: null as KeyValueStore | null },
  LAUNCHER_SECRET: "test-launcher-secret-please-do-not-use-in-prod",
  WEB_SECRET: "test-web-secret-please-do-not-use-in-prod",
  mocks: {
    listPacks: vi.fn(),
    getLatestPack: vi.fn(),
    listReleases: vi.fn(),
    resolveFiles: vi.fn(),
    openStorageFile: vi.fn(),
    openStorageSnapshot: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    redis: { url: null },
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
vi.mock("@/services/key-value-store", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/key-value-store")>();
  const current = (): KeyValueStore => {
    if (!cache.current) throw new Error("no cache for this test");
    return cache.current;
  };
  return {
    ...actual,
    createKeyValueStore: (): KeyValueStore => ({
      get: (key) => current().get(key),
      getMany: (keys) => current().getMany(keys),
      set: (key, value, ttlMs) => current().set(key, value, ttlMs),
    }),
  };
});
vi.mock("@/services/launcher/pack/launcher-pack.service", () => ({
  launcherPackService: {
    listPacks: mocks.listPacks,
    getLatestPack: mocks.getLatestPack,
    listReleases: mocks.listReleases,
    resolveFiles: mocks.resolveFiles,
    openStorageFile: mocks.openStorageFile,
    openStorageSnapshot: mocks.openStorageSnapshot,
  },
}));

import express from "express";
import { AppError, errorHandler } from "@/app/middleware/error-handler";
import launcherPackRoutes from "@/app/features/launcher/pack/launcher-pack.routes";
import { launcherJwtService } from "@/services/auth/launcher/launcher-jwt.service";
import { MemoryKeyValueStore } from "@/services/key-value-store";

const PACK = {
  project: {
    source: "curseforge",
    id: "1660984",
    slug: "createrington-rails-n-sails",
    kind: "modpack",
    name: "Createrington Rails 'n Sails",
    summary: "Trains, ships and a community to build them with",
    author: "createrington",
    iconUrl: "https://media.forgecdn.net/avatars/thumbnails/3/4/256/256/b.png",
    url: "https://www.curseforge.com/minecraft/modpacks/createrington-rails-n-sails",
  },
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
    servedBy: "curseforge",
  },
};

const LISTED = {
  releases: [
    {
      ...PACK,
      changelog: {
        previousVersion: "1.3.3",
        added: [],
        updated: [
          {
            projectId: 328085,
            name: "Create",
            url: "https://www.curseforge.com/minecraft/mc-mods/create",
            iconUrl: null,
            label: "create-1.21.1-6.0.10",
            previousLabel: "create-1.21.1-6.0.9",
            disabled: false,
          },
        ],
        removed: [],
        notes: "Trains are faster now.",
      },
    },
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
      changelog: {
        previousVersion: null,
        added: [],
        updated: [],
        removed: [],
        notes: null,
      },
    },
  ],
  total: 2,
};

const PACKS = [
  {
    slug: "createrington",
    source: "curseforge",
    name: PACK.project.name,
    summary: PACK.project.summary,
    iconUrl: PACK.project.iconUrl,
    server: { id: 1, name: "Rails 'n Sails", identifier: "rails" },
    latest: PACK,
  },
  {
    slug: "test",
    source: "sandbox",
    name: "Createrington Test Server",
    summary: null,
    iconUrl: null,
    server: { id: 2, name: "Test Server", identifier: "test" },
    latest: null,
  },
];

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

async function getPacks(headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/launcher/packs`, { headers });
}

async function getLatest(
  headers: Record<string, string> = {},
  slug = "createrington",
) {
  return await fetch(`${baseUrl}/api/launcher/packs/${slug}/latest`, {
    headers,
  });
}

async function getReleases(
  headers: Record<string, string> = {},
  query = "",
  slug = "createrington",
) {
  return await fetch(`${baseUrl}/api/launcher/packs/${slug}/releases${query}`, {
    headers,
  });
}

async function getStorageFile(
  fileId: string,
  headers: Record<string, string> = {},
) {
  return await fetch(`${baseUrl}/api/launcher/packs/files/${fileId}`, {
    headers,
  });
}

async function getStorageSnapshot(
  id: string,
  headers: Record<string, string> = {},
) {
  return await fetch(`${baseUrl}/api/launcher/packs/files/snapshot/${id}`, {
    headers,
  });
}

function download(fileName: string, content: string) {
  const bytes = Buffer.from(content);
  return {
    fileName,
    size: bytes.length,
    body: new Blob([bytes]).stream(),
  };
}

async function resolve(body: unknown, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/launcher/packs/files/resolve`, {
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
      familyId: "0f6a7b1c-5d4e-4f3a-9b2c-1d0e9f8a7b6c",
    })}`,
  };

  const app = express();
  app.use(express.json());
  app.use("/api/launcher/packs", launcherPackRoutes);
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
  vi.useRealTimers();
  cache.current = new MemoryKeyValueStore();
  mocks.listPacks.mockResolvedValue(PACKS);
  mocks.getLatestPack.mockResolvedValue(PACK);
  mocks.listReleases.mockResolvedValue(LISTED);
  mocks.resolveFiles.mockResolvedValue(RESOLVED);
});

describe("GET /api/launcher/packs", () => {
  it("gives a launcher session every pack it may install", async () => {
    const res = await getPacks(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { packs: PACKS } });
  });

  it("tags the list and lets the launcher keep it for a minute", async () => {
    const res = await getPacks(session);

    expect(res.headers.get("etag")).toMatch(/^"[A-Za-z0-9_-]+"$/);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("answers 304 to a launcher that already holds the same list, without asking the service again", async () => {
    const first = await getPacks(session);
    const etag = first.headers.get("etag");

    const res = await getPacks({
      ...session,
      "If-None-Match": etag ?? "",
      "Cache-Control": "max-age=0",
    });

    expect(etag).toBeTruthy();
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await res.text()).toBe("");
    expect(mocks.listPacks).toHaveBeenCalledTimes(1);
  });

  it("answers the list in full to a launcher that holds another version", async () => {
    await getPacks(session);

    const res = await getPacks({ ...session, "If-None-Match": '"other"' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { packs: PACKS } });
  });

  it("answers a repeat within the minute from what it stored", async () => {
    await getPacks(session);
    mocks.listPacks.mockResolvedValue([]);

    const res = await getPacks(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { packs: PACKS } });
    expect(mocks.listPacks).toHaveBeenCalledTimes(1);
  });

  it("asks the service again once the minute is over", async () => {
    await getPacks(session);
    mocks.listPacks.mockResolvedValue([]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);

    const res = await getPacks(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { packs: [] } });
    expect(mocks.listPacks).toHaveBeenCalledTimes(2);
  });

  it("answers 401 without a launcher session", async () => {
    const res = await getPacks();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
    expect(mocks.listPacks).not.toHaveBeenCalled();
  });
});

describe("GET /api/launcher/packs/:slug/latest", () => {
  it("gives a launcher session the latest release of the named pack", async () => {
    const res = await getLatest(session, "test");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: PACK });
    expect(mocks.getLatestPack).toHaveBeenCalledWith("test");
  });

  it("answers 304 to a launcher that already holds the release, without asking the service again", async () => {
    const first = await getLatest(session);
    const etag = first.headers.get("etag");

    const res = await getLatest({
      ...session,
      "If-None-Match": etag ?? "",
      "Cache-Control": "max-age=0",
    });

    expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
    expect(res.status).toBe(304);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await res.text()).toBe("");
    expect(mocks.getLatestPack).toHaveBeenCalledTimes(1);
  });

  it("answers a repeat within the minute from what it stored", async () => {
    await getLatest(session);

    const res = await getLatest(session);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await res.json()).toEqual({ success: true, data: PACK });
    expect(mocks.getLatestPack).toHaveBeenCalledTimes(1);
  });

  it("stores the answer of each pack on its own", async () => {
    await getLatest(session, "createrington");
    await getLatest(session, "test");

    expect(mocks.getLatestPack).toHaveBeenCalledTimes(2);
    expect(mocks.getLatestPack).toHaveBeenCalledWith("createrington");
    expect(mocks.getLatestPack).toHaveBeenCalledWith("test");
  });

  it("passes on that the pack is not offered", async () => {
    mocks.getLatestPack.mockRejectedValue(
      new AppError(
        "The launcher offers no pack by this name",
        404,
        true,
        undefined,
        {
          code: "PACK_NOT_FOUND",
        },
      ),
    );

    const res = await getLatest(session, "nope");

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("PACK_NOT_FOUND");
  });

  it("does not keep a refusal", async () => {
    mocks.getLatestPack.mockRejectedValueOnce(
      new AppError(
        "No modpack release is available to the launcher yet",
        404,
        true,
        undefined,
        { code: "PACK_UNAVAILABLE" },
      ),
    );

    const refused = await getLatest(session);
    const res = await getLatest(session);

    expect(refused.status).toBe(404);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: PACK });
    expect(mocks.getLatestPack).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["an upper-case slug", "Createrington"],
    ["a slug with a space", "my%20pack"],
    ["a slug with an underscore", "my_pack"],
    ["a slug that starts with a hyphen", "-pack"],
    ["a slug longer than 40 characters", "a".repeat(41)],
  ])("refuses %s", async (_label, slug) => {
    const res = await getLatest(session, slug);

    expect(res.status).toBe(400);
    expect(mocks.getLatestPack).not.toHaveBeenCalled();
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

describe("GET /api/launcher/packs/:slug/releases", () => {
  it("gives a launcher session the installable releases of the named pack", async () => {
    const res = await getReleases(session, "", "test");

    expect(mocks.listReleases).toHaveBeenCalledWith("test", {
      page: 0,
      limit: 10,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        releases: LISTED.releases,
        pagination: { page: 0, limit: 10, total: 2, totalPages: 1 },
      },
    });
  });

  it("answers 304 to a launcher that already holds the page, without asking the service again", async () => {
    const first = await getReleases(session, "?page=1&limit=5");
    const etag = first.headers.get("etag");

    const res = await getReleases(
      { ...session, "If-None-Match": etag ?? "", "Cache-Control": "max-age=0" },
      "?page=1&limit=5",
    );

    expect(etag).toMatch(/^"[A-Za-z0-9_-]+"$/);
    expect(res.status).toBe(304);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    expect(await res.text()).toBe("");
    expect(mocks.listReleases).toHaveBeenCalledTimes(1);
  });

  it("stores each page on its own", async () => {
    await getReleases(session, "?page=0&limit=5");
    await getReleases(session, "?page=1&limit=5");
    await getReleases(session, "?page=1&limit=10");
    await getReleases(session, "?page=1&limit=5");

    expect(mocks.listReleases).toHaveBeenCalledTimes(3);
  });

  it("answers with an empty list when no release can be installed", async () => {
    mocks.listReleases.mockResolvedValue({ releases: [], total: 0 });

    const res = await getReleases(session);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        releases: [],
        pagination: { page: 0, limit: 10, total: 0, totalPages: 0 },
      },
    });
  });

  it("says how many pages the named size makes of the total", async () => {
    mocks.listReleases.mockResolvedValue({
      releases: [LISTED.releases[1]],
      total: 7,
    });

    const res = await getReleases(session, "?page=1&limit=3");

    expect((await res.json()).data.pagination).toEqual({
      page: 1,
      limit: 3,
      total: 7,
      totalPages: 3,
    });
  });

  it("asks for the first page of 10 when the launcher names no page", async () => {
    await getReleases(session);

    expect(mocks.listReleases).toHaveBeenCalledWith("createrington", {
      page: 0,
      limit: 10,
    });
  });

  it("asks for the page and size the launcher names", async () => {
    const res = await getReleases(session, "?page=2&limit=5");

    expect(res.status).toBe(200);
    expect(mocks.listReleases).toHaveBeenCalledWith("createrington", {
      page: 2,
      limit: 5,
    });
  });

  it("asks for the one release of the version the launcher names", async () => {
    mocks.listReleases.mockResolvedValue({
      releases: [LISTED.releases[1]],
      total: 1,
    });

    const res = await getReleases(session, "?version=1.3.3&page=0&limit=25");

    expect(mocks.listReleases).toHaveBeenCalledWith("createrington", {
      page: 0,
      limit: 25,
      version: "1.3.3",
    });
    expect((await res.json()).data).toEqual({
      releases: [LISTED.releases[1]],
      pagination: { page: 0, limit: 25, total: 1, totalPages: 1 },
    });
  });

  it("stores the page of one version apart from the plain page and from other versions", async () => {
    await getReleases(session, "?version=1.3.3");
    await getReleases(session);
    await getReleases(session, "?version=1.3.4");
    await getReleases(session, "?version=1.3.3");

    expect(mocks.listReleases).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a negative page", "?page=-1"],
    ["a page that is not a number", "?page=first"],
    ["a size of zero", "?limit=0"],
    ["a size above the maximum", "?limit=26"],
    ["a fractional size", "?limit=2.5"],
    ["an empty version", "?version="],
    ["a version longer than 64 characters", `?version=${"1".repeat(65)}`],
  ])("refuses %s", async (_label, query) => {
    const res = await getReleases(session, query);

    expect(res.status).toBe(400);
    expect(mocks.listReleases).not.toHaveBeenCalled();
  });

  it("answers 401 without a launcher session", async () => {
    const res = await getReleases();

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
    expect(mocks.listReleases).not.toHaveBeenCalled();
  });
});

describe("POST /api/launcher/packs/files/resolve", () => {
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

describe("GET /api/launcher/packs/files/:fileId", () => {
  it("streams the file the service opened, named and sized for the launcher", async () => {
    mocks.openStorageFile.mockResolvedValue(
      download("create-1.21.1-6.0.10.jar", "the bytes of the jar"),
    );

    const res = await getStorageFile("7000001", session);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("20");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="create-1.21.1-6.0.10.jar"',
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("the bytes of the jar");
    expect(mocks.openStorageFile).toHaveBeenCalledWith(
      7000001,
      expect.any(AbortSignal),
    );
  });

  it("passes on that no file is served under the id", async () => {
    mocks.openStorageFile.mockRejectedValue(
      new AppError(
        "No pack file is served under this id",
        404,
        true,
        undefined,
        { code: "FILE_NOT_FOUND" },
      ),
    );

    const res = await getStorageFile("7000001", session);

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("FILE_NOT_FOUND");
  });

  it("passes on that the file cannot be served right now", async () => {
    mocks.openStorageFile.mockRejectedValue(
      new AppError(
        "The file cannot be served right now",
        502,
        true,
        undefined,
        { code: "FILE_UNAVAILABLE" },
      ),
    );

    const res = await getStorageFile("7000001", session);

    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("FILE_UNAVAILABLE");
  });

  it.each([
    ["a name instead of an id", "create.jar"],
    ["a negative id", "-1"],
    ["a fractional id", "1.5"],
    ["an id past the integer range", "2147483648"],
  ])("refuses %s", async (_label, fileId) => {
    const res = await getStorageFile(fileId, session);

    expect(res.status).toBe(400);
    expect(mocks.openStorageFile).not.toHaveBeenCalled();
  });

  it("answers 401 without a launcher session", async () => {
    const res = await getStorageFile("7000001");

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
    expect(mocks.openStorageFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/launcher/packs/files/snapshot/:id", () => {
  it("streams the snapshot zip the service opened", async () => {
    mocks.openStorageSnapshot.mockResolvedValue(
      download("createrington-test-7.zip", "zip bytes"),
    );

    const res = await getStorageSnapshot("7", session);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("9");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="createrington-test-7.zip"',
    );
    expect(await res.text()).toBe("zip bytes");
    expect(mocks.openStorageSnapshot).toHaveBeenCalledWith(
      7,
      expect.any(AbortSignal),
    );
    expect(mocks.openStorageFile).not.toHaveBeenCalled();
  });

  it("passes on that no snapshot is served under the id", async () => {
    mocks.openStorageSnapshot.mockRejectedValue(
      new AppError(
        "No pack file is served under this id",
        404,
        true,
        undefined,
        { code: "FILE_NOT_FOUND" },
      ),
    );

    const res = await getStorageSnapshot("7", session);

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("FILE_NOT_FOUND");
  });

  it("refuses an id that is not a positive integer", async () => {
    const res = await getStorageSnapshot("latest", session);

    expect(res.status).toBe(400);
    expect(mocks.openStorageSnapshot).not.toHaveBeenCalled();
  });

  it("answers 401 without a launcher session", async () => {
    const res = await getStorageSnapshot("7");

    expect(res.status).toBe(401);
    expect(mocks.openStorageSnapshot).not.toHaveBeenCalled();
  });
});

describe("storage downloads", () => {
  function slowBody(chunks: number, chunkSize: number, delayMs: number) {
    let sent = 0;
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (sent === chunks) {
          controller.close();
          return;
        }
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        controller.enqueue(new Uint8Array(chunkSize).fill(sent % 256));
        sent++;
      },
    });
  }

  it("streams a large file to the end", async () => {
    const chunks = 48;
    const chunkSize = 64 * 1024;
    mocks.openStorageFile.mockResolvedValue({
      fileName: "big.jar",
      size: chunks * chunkSize,
      body: slowBody(chunks, chunkSize, 0),
    });

    const res = await getStorageFile("7000001", session);
    const bytes = new Uint8Array(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(bytes.byteLength).toBe(chunks * chunkSize);
    expect(bytes[bytes.byteLength - 1]).toBe((chunks - 1) % 256);
  });

  it("cancels the download the service opened when the launcher goes away", async () => {
    let seen: AbortSignal | undefined;
    mocks.openStorageFile.mockImplementation(async (_id, signal) => {
      seen = signal;
      return {
        fileName: "big.jar",
        size: 1000 * 1024,
        body: slowBody(1000, 1024, 5),
      };
    });
    const launcher = new AbortController();

    const res = await fetch(`${baseUrl}/api/launcher/packs/files/7000001`, {
      headers: session,
      signal: launcher.signal,
    });
    const reader = res.body?.getReader();
    await reader?.read();
    launcher.abort();
    await vi.waitFor(() => expect(seen?.aborted).toBe(true));
  });
});

describe("storage downloads of the wrong length", () => {
  it("cuts the connection instead of ending a body shorter than announced", async () => {
    mocks.openStorageFile.mockResolvedValue({
      fileName: "short.jar",
      size: 1000,
      body: new Blob([Buffer.alloc(10)]).stream(),
    });

    const res = await getStorageFile("7000001", session);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("1000");
    await expect(res.arrayBuffer()).rejects.toThrow();
  });
});
