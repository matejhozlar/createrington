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
    search: vi.fn(),
    getProjects: vi.fn(),
    listFiles: vi.fn(),
    getFile: vi.fn(),
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
vi.mock("@/services/launcher/content/launcher-content.service", () => ({
  launcherContentService: {
    search: mocks.search,
    getProjects: mocks.getProjects,
    listFiles: mocks.listFiles,
    getFile: mocks.getFile,
  },
}));

import express from "express";
import { AppError, errorHandler } from "@/app/middleware/error-handler";
import launcherContentRoutes from "@/app/features/launcher/content/launcher-content.routes";
import { launcherJwtService } from "@/services/auth/launcher/launcher-jwt.service";

const PROJECT = {
  source: "curseforge",
  id: "328085",
  slug: "create",
  kind: "mod",
  name: "Create",
  summary: "Aesthetic Technology that empowers the Player",
  author: "simibubi",
  iconUrl: "https://media.forgecdn.net/avatars/create.png",
  url: "https://www.curseforge.com/minecraft/mc-mods/create",
};

const FILE = {
  source: "curseforge",
  projectId: "328085",
  id: "7000001",
  fileName: "create-1.21.1-6.0.10.jar",
  size: 19123767,
  sha1: "e".repeat(40),
  pageUrl: "https://www.curseforge.com/minecraft/mc-mods/create/files/7000001",
  download: {
    servedBy: "curseforge",
    url: "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
  },
  displayName: "Create 6.0.10 for mc1.21.1",
  releaseType: "release",
  publishedAt: "2026-04-21T22:20:00.503Z",
  gameVersions: ["1.21.1"],
  loaders: ["neoforge"],
  dependencies: [],
};

let server: Server;
let baseUrl: string;
let playerNumber = 0;

function sessionOf(minecraftUuid: string): Record<string, string> {
  return {
    Authorization: `Bearer ${launcherJwtService.generate({
      minecraftUuid,
      minecraftUsername: "Alice_MC",
    })}`,
  };
}

function newSession(): Record<string, string> {
  playerNumber += 1;
  return sessionOf(
    `069a79f4-44e9-4726-a5be-${String(playerNumber).padStart(12, "0")}`,
  );
}

async function get(path: string, headers: Record<string, string> = {}) {
  return await fetch(`${baseUrl}/api/launcher/content${path}`, { headers });
}

async function postProjects(
  body: unknown,
  headers: Record<string, string> = {},
) {
  return await fetch(`${baseUrl}/api/launcher/content/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/launcher/content", launcherContentRoutes);
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
  mocks.search.mockResolvedValue({
    projects: [{ ...PROJECT, downloads: 213407951 }],
    total: 45,
  });
  mocks.getProjects.mockResolvedValue({
    projects: [PROJECT],
    unknownProjectIds: ["999999999"],
  });
  mocks.listFiles.mockResolvedValue({ files: [FILE], total: 11 });
  mocks.getFile.mockResolvedValue(FILE);
});

describe("GET /api/launcher/content/search", () => {
  it("searches mods on the first page by default", async () => {
    const res = await get("/search", newSession());

    expect(res.status).toBe(200);
    expect(mocks.search).toHaveBeenCalledWith({
      query: "",
      kind: "mod",
      page: 0,
      limit: 20,
    });
    expect(await res.json()).toEqual({
      success: true,
      data: {
        projects: [{ ...PROJECT, downloads: 213407951 }],
        pagination: { page: 0, limit: 20, total: 45, totalPages: 3 },
      },
    });
  });

  it("passes the text, kind, version, loader and page on", async () => {
    await get(
      "/search?query=%20create%20&kind=shader&minecraftVersion=1.21.1&loader=neoforge&page=2&limit=10",
      newSession(),
    );

    expect(mocks.search).toHaveBeenCalledWith({
      query: "create",
      kind: "shader",
      minecraftVersion: "1.21.1",
      loader: "neoforge",
      page: 2,
      limit: 10,
    });
  });

  it.each([
    ["an unknown kind", "?kind=modpack"],
    ["an unknown loader", "?loader=rift"],
    ["a version that is not a release", "?minecraftVersion=latest"],
    ["a text that is too long", `?query=${"a".repeat(101)}`],
    ["a negative page", "?page=-1"],
    ["a page size of zero", "?limit=0"],
    ["a page size above the cap", "?limit=51"],
    ["a page past what CurseForge lets a search reach", "?page=500&limit=20"],
  ])("refuses %s", async (_label, query) => {
    const res = await get(`/search${query}`, newSession());

    expect(res.status).toBe(400);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("answers the last page CurseForge lets a search reach", async () => {
    const res = await get("/search?page=499&limit=20", newSession());

    expect(res.status).toBe(200);
  });

  it("answers 401 without a launcher session", async () => {
    const res = await get("/search");

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("AUTH_REQUIRED");
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("answers 401 to a website token", async () => {
    const webToken = jwt.sign({ discordId: "1", role: "admin" }, WEB_SECRET, {
      expiresIn: "15m",
    });

    const res = await get("/search", { Authorization: `Bearer ${webToken}` });

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("INVALID_TOKEN");
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("passes the service's error code on when CurseForge cannot be asked", async () => {
    mocks.search.mockRejectedValue(
      new AppError(
        "CurseForge cannot be asked right now",
        503,
        true,
        undefined,
        {
          code: "CONTENT_UNAVAILABLE",
        },
      ),
    );

    const res = await get("/search", newSession());

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("CONTENT_UNAVAILABLE");
  });
});

describe("POST /api/launcher/content/projects", () => {
  it("looks the projects up by their ids", async () => {
    const res = await postProjects(
      { projectIds: ["328085", "999999999"] },
      newSession(),
    );

    expect(res.status).toBe(200);
    expect(mocks.getProjects).toHaveBeenCalledWith([328085, 999999999]);
    expect(await res.json()).toEqual({
      success: true,
      data: { projects: [PROJECT], unknownProjectIds: ["999999999"] },
    });
  });

  it.each([
    ["no ids", {}],
    ["an empty list", { projectIds: [] }],
    ["an id that is a number", { projectIds: [328085] }],
    ["an id that is not a CurseForge id", { projectIds: ["AANobbMI"] }],
    ["an id of zero", { projectIds: ["0"] }],
    ["an id too large for CurseForge", { projectIds: ["2147483648"] }],
    [
      "more ids than one request may carry",
      { projectIds: Array(101).fill("1") },
    ],
  ])("refuses %s", async (_label, body) => {
    const res = await postProjects(body, newSession());

    expect(res.status).toBe(400);
    expect(mocks.getProjects).not.toHaveBeenCalled();
  });

  it("answers 401 without a launcher session", async () => {
    const res = await postProjects({ projectIds: ["328085"] });

    expect(res.status).toBe(401);
    expect(mocks.getProjects).not.toHaveBeenCalled();
  });
});

describe("GET /api/launcher/content/projects/:id/files", () => {
  it("lists the first page of a project's files by default", async () => {
    const res = await get("/projects/328085/files", newSession());

    expect(res.status).toBe(200);
    expect(mocks.listFiles).toHaveBeenCalledWith(328085, {
      page: 0,
      limit: 20,
    });
    expect(await res.json()).toEqual({
      success: true,
      data: {
        files: [FILE],
        pagination: { page: 0, limit: 20, total: 11, totalPages: 1 },
      },
    });
  });

  it("passes the version, loader and page on", async () => {
    await get(
      "/projects/328085/files?minecraftVersion=1.21.1&loader=fabric&page=1&limit=5",
      newSession(),
    );

    expect(mocks.listFiles).toHaveBeenCalledWith(328085, {
      minecraftVersion: "1.21.1",
      loader: "fabric",
      page: 1,
      limit: 5,
    });
  });

  it.each([
    ["a project id that is not a number", "/projects/create/files"],
    ["an unknown loader", "/projects/328085/files?loader=rift"],
    ["a page size above the cap", "/projects/328085/files?limit=51"],
  ])("refuses %s", async (_label, path) => {
    const res = await get(path, newSession());

    expect(res.status).toBe(400);
    expect(mocks.listFiles).not.toHaveBeenCalled();
  });

  it("answers 404 with the service's code for an unknown project", async () => {
    mocks.listFiles.mockRejectedValue(
      new AppError("no such project", 404, true, undefined, {
        code: "PROJECT_NOT_FOUND",
      }),
    );

    const res = await get("/projects/999999999/files", newSession());

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("answers 401 without a launcher session", async () => {
    const res = await get("/projects/328085/files");

    expect(res.status).toBe(401);
    expect(mocks.listFiles).not.toHaveBeenCalled();
  });
});

describe("GET /api/launcher/content/files/:id", () => {
  it("answers one file", async () => {
    const res = await get("/files/7000001", newSession());

    expect(res.status).toBe(200);
    expect(mocks.getFile).toHaveBeenCalledWith(7000001);
    expect(await res.json()).toEqual({ success: true, data: { file: FILE } });
  });

  it("refuses a file id that is not a number", async () => {
    const res = await get("/files/latest", newSession());

    expect(res.status).toBe(400);
    expect(mocks.getFile).not.toHaveBeenCalled();
  });

  it("answers 404 with the service's code for an unknown file", async () => {
    mocks.getFile.mockRejectedValue(
      new AppError("no such file", 404, true, undefined, {
        code: "FILE_NOT_FOUND",
      }),
    );

    const res = await get("/files/999999999", newSession());

    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("FILE_NOT_FOUND");
  });

  it("answers 401 without a launcher session", async () => {
    const res = await get("/files/7000001");

    expect(res.status).toBe(401);
    expect(mocks.getFile).not.toHaveBeenCalled();
  });
});

describe("the content rate limit", () => {
  it("slows one player down after 60 requests in a minute and leaves another alone", async () => {
    const busy = newSession();
    const other = newSession();

    const statuses: number[] = [];
    for (let request = 0; request < 61; request += 1) {
      statuses.push((await get("/files/7000001", busy)).status);
    }

    expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
    expect(statuses[60]).toBe(429);
    expect((await get("/files/7000001", other)).status).toBe(200);
  });
});
