import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/curseforge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/curseforge")>();
  return {
    ...actual,
    searchProjects: vi.fn(),
    getMods: vi.fn(),
    getProjectDescription: vi.fn(),
    listCategories: vi.fn(),
    listProjectFiles: vi.fn(),
    getContentFiles: vi.fn(),
    getFileChangelog: vi.fn(),
    matchFingerprints: vi.fn(),
    resolveFileDownloads: vi.fn(),
  };
});
vi.mock("@/services/feature-flag", () => ({
  FeatureFlags: { launcherCurseforgeCdn: "launcher_curseforge_cdn" },
  featureFlagService: { isEnabled: vi.fn() },
}));

import { ContentGatewayError } from "@createrington/content-gateway-client";
import { currentContentPool } from "@/services/content-gateway";
import {
  getContentFiles,
  getFileChangelog,
  getMods,
  getProjectDescription,
  listCategories,
  listProjectFiles,
  matchFingerprints,
  resolveFileDownloads,
  searchProjects,
  type CurseForgeContentFile,
  type CurseForgeFileDownload,
  type CurseForgeProjectData,
  type CurseForgeProjectHit,
} from "@/services/curseforge";
import { featureFlagService } from "@/services/feature-flag";
import { launcherContentService } from "@/services/launcher/content/launcher-content.service";

const CREATE_PAGE = "https://www.curseforge.com/minecraft/mc-mods/create";

function makeHit(
  overrides: Partial<CurseForgeProjectHit> = {},
): CurseForgeProjectHit {
  return {
    id: 328085,
    classId: 6,
    slug: "create",
    name: "Create",
    summary: "Aesthetic Technology that empowers the Player",
    websiteUrl: CREATE_PAGE,
    thumbnailUrl: "https://media.forgecdn.net/avatars/create.png",
    primaryAuthor: "simibubi",
    downloadCount: 213407951,
    ...overrides,
  };
}

function makeContentFile(
  overrides: Partial<CurseForgeContentFile> = {},
): CurseForgeContentFile {
  return {
    id: 7000001,
    projectId: 328085,
    gameId: 432,
    displayName: "Create 6.0.10 for mc1.21.1",
    fileName: "create-1.21.1-6.0.10.jar",
    fileDate: "2026-04-21T22:20:00.503Z",
    releaseType: 1,
    downloadUrl:
      "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
    fileLength: 19123767,
    sha1: "0e97e49837bed766e6f28a4c95b04885d6acc353",
    gameVersions: ["1.21.1", "NeoForge"],
    dependencies: [],
    ...overrides,
  };
}

function makeProjectData(
  projectId: number,
  overrides: Partial<CurseForgeProjectData> = {},
): CurseForgeProjectData {
  return {
    id: projectId,
    classId: 6,
    slug: `vitest-mod-${projectId}`,
    name: `Vitest Mod ${projectId}`,
    summary: "A synthetic test project",
    websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-mod-${projectId}`,
    wikiUrl: null,
    issuesUrl: null,
    sourceUrl: null,
    thumbnailUrl: null,
    authors: [{ id: 1, name: "vitest", url: "https://example.com" }],
    categories: [],
    screenshots: [],
    downloadCount: 0,
    isAvailable: true,
    allowModDistribution: true,
    dateCreated: "2026-10-01T00:00:00.000Z",
    dateModified: "2026-10-05T00:00:00.000Z",
    dateReleased: "2026-10-05T00:00:00.000Z",
    latestFilesIndexes: [],
    environmentHint: null,
    ...overrides,
  };
}

function createProject() {
  return makeProjectData(328085, {
    slug: "create",
    name: "Create",
    websiteUrl: CREATE_PAGE,
  });
}

const CREATE_LATEST_FILES: CurseForgeProjectData["latestFilesIndexes"] = [
  {
    gameVersion: "1.21.1",
    fileId: 7000001,
    filename: "create-1.21.1-6.0.10.jar",
    releaseType: 1,
    modLoader: 6,
  },
  {
    gameVersion: "1.20.1",
    fileId: 6000002,
    filename: "create-1.20.1-6.0.9.jar",
    releaseType: 2,
    modLoader: 1,
  },
];

const FIRST_PAGE = { page: 0, limit: 20 };

const PACK_PAGE =
  "https://www.curseforge.com/minecraft/modpacks/all-the-mods-10";

function packProject() {
  return makeProjectData(925200, {
    classId: 4471,
    slug: "all-the-mods-10",
    name: "All the Mods 10",
    summary: "The kitchen sink for 1.21.1",
    websiteUrl: PACK_PAGE,
    thumbnailUrl: "https://media.forgecdn.net/avatars/atm10.png",
  });
}

function packZip(overrides: Partial<CurseForgeContentFile> = {}) {
  return makeContentFile({
    id: 6500000,
    projectId: 925200,
    displayName: "All the Mods 10-2.40",
    fileName: "All the Mods 10-2.40.zip",
    downloadUrl:
      "https://edge.forgecdn.net/files/6500/0/All%20the%20Mods%2010-2.40.zip",
    fileLength: 2481204,
    sha1: "9a1c03ad1b5f9c4f3c0e1f6a3b2d4e5f60718293",
    gameVersions: ["1.21.1", "NeoForge"],
    ...overrides,
  });
}

const BLOCKED_CDN_URL =
  "https://mediafilez.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar";
const MODRINTH_URL =
  "https://cdn.modrinth.com/data/LNytGWDc/versions/abc/create-1.21.1-6.0.10.jar";

function switchCdn(enabled: boolean) {
  vi.mocked(featureFlagService.isEnabled).mockImplementation(
    async (name) => enabled && name === "launcher_curseforge_cdn",
  );
}

function resolveDownloads(
  downloads: Record<number, Partial<CurseForgeFileDownload>>,
) {
  vi.mocked(resolveFileDownloads).mockImplementation(
    async (fileIds) =>
      new Map(
        fileIds.map((fileId) => [
          fileId,
          { source: null, url: null, retry: false, ...downloads[fileId] },
        ]),
      ),
  );
}

function refusal(retryAfterMs: number | null): ContentGatewayError {
  return new ContentGatewayError(
    503,
    {
      code: retryAfterMs === null ? "UPSTREAM_TIMEOUT" : "BUDGET_SPENT",
      message: "the gateway refused the call",
      pool: "launcher",
      retryAfterMs,
    },
    "refused",
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  resolveDownloads({});
});

describe("LauncherContentService.search", () => {
  it("answers the matching projects with their downloads and the total", async () => {
    vi.mocked(searchProjects).mockResolvedValue({
      projects: [makeHit()],
      total: 2115,
    });

    const found = await launcherContentService.search({
      query: "create",
      kind: "mod",
      minecraftVersion: "1.21.1",
      loader: "neoforge",
      page: 2,
      limit: 20,
    });

    expect(searchProjects).toHaveBeenCalledWith({
      query: "create",
      classId: 6,
      gameVersion: "1.21.1",
      modLoaderType: 6,
      categoryIds: [],
      sortField: 2,
      index: 40,
      pageSize: 20,
    });
    expect(found).toEqual({
      projects: [
        {
          source: "curseforge",
          id: "328085",
          slug: "create",
          kind: "mod",
          name: "Create",
          summary: "Aesthetic Technology that empowers the Player",
          author: "simibubi",
          iconUrl: "https://media.forgecdn.net/avatars/create.png",
          url: CREATE_PAGE,
          downloads: 213407951,
        },
      ],
      total: 2115,
    });
  });

  it("asks CurseForge in the launcher's pool", async () => {
    let pool: string | null = null;
    vi.mocked(searchProjects).mockImplementation(async () => {
      pool = currentContentPool();
      return { projects: [], total: 0 };
    });

    await launcherContentService.search({
      query: "create",
      kind: "mod",
      ...FIRST_PAGE,
    });

    expect(pool).toBe("launcher");
  });

  it.each(["shader", "resourcepack"] as const)(
    "does not filter a %s search by loader",
    async (kind) => {
      vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });

      await launcherContentService.search({
        query: "",
        kind,
        loader: "neoforge",
        ...FIRST_PAGE,
      });

      expect(vi.mocked(searchProjects).mock.calls[0]?.[0]).toMatchObject({
        modLoaderType: null,
      });
    },
  );

  it("asks CurseForge for the categories, each once and in order, and the sort order it is given", async () => {
    vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });

    await launcherContentService.search({
      query: "",
      kind: "mod",
      minecraftVersion: "1.21.1",
      loader: "neoforge",
      categoryIds: [420, 412, 420],
      sort: "newest",
      ...FIRST_PAGE,
    });

    expect(searchProjects).toHaveBeenCalledWith({
      query: "",
      classId: 6,
      gameVersion: "1.21.1",
      modLoaderType: 6,
      categoryIds: [412, 420],
      sortField: 11,
      index: 0,
      pageSize: 20,
    });
  });

  it("never counts more results than a search can page through", async () => {
    vi.mocked(searchProjects).mockResolvedValue({
      projects: [],
      total: 250_000,
    });

    const found = await launcherContentService.search({
      query: "",
      kind: "mod",
      ...FIRST_PAGE,
    });

    expect(found.total).toBe(10_000);
  });

  it("answers 503 when CurseForge fails", async () => {
    vi.mocked(searchProjects).mockRejectedValue(
      new Error("CurseForge search failed (500)"),
    );

    await expect(
      launcherContentService.search({
        query: "create",
        kind: "mod",
        ...FIRST_PAGE,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
  });
});

describe("LauncherContentService.listCategories", () => {
  const technology = {
    id: 412,
    name: "Technology",
    slug: "technology",
    iconUrl: "https://media.forgecdn.net/avatars/technology.png",
    parentCategoryId: 6,
  };
  const energy = {
    id: 417,
    name: "Energy",
    slug: "technology-energy",
    iconUrl: null,
    parentCategoryId: 412,
  };

  it("answers the categories of the kind's class with their parents", async () => {
    vi.mocked(listCategories).mockResolvedValue([technology, energy]);

    const categories = await launcherContentService.listCategories("mod");

    expect(listCategories).toHaveBeenCalledWith(6);
    expect(categories).toEqual([
      {
        id: "412",
        name: "Technology",
        slug: "technology",
        iconUrl: "https://media.forgecdn.net/avatars/technology.png",
        parentId: null,
      },
      {
        id: "417",
        name: "Energy",
        slug: "technology-energy",
        iconUrl: null,
        parentId: "412",
      },
    ]);
  });

  it("answers 503 when CurseForge fails", async () => {
    vi.mocked(listCategories).mockRejectedValue(
      new Error("CurseForge categories failed (500)"),
    );

    await expect(
      launcherContentService.listCategories("mod"),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
  });

  it("answers 503 when CurseForge lists no categories", async () => {
    vi.mocked(listCategories).mockResolvedValue([]);

    await expect(
      launcherContentService.listCategories("mod"),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
  });
});

describe("LauncherContentService.getProjects", () => {
  it("answers the known projects and names the ids it does not know", async () => {
    vi.mocked(getMods).mockResolvedValue([
      createProject(),
      makeProjectData(6945001, { classId: 6945 }),
    ]);

    const answer = await launcherContentService.getProjects([
      328085, 6945001, 999999999, 328085,
    ]);

    expect(getMods).toHaveBeenCalledWith([328085, 6945001, 999999999]);
    expect(answer.projects).toEqual([
      {
        source: "curseforge",
        id: "328085",
        slug: "create",
        kind: "mod",
        name: "Create",
        summary: "A synthetic test project",
        author: "vitest",
        iconUrl: null,
        url: CREATE_PAGE,
        latestFiles: [],
      },
    ]);
    expect(answer.unknownProjectIds).toEqual(["6945001", "999999999"]);
  });

  it("answers the newest file of a project per Minecraft version and loader", async () => {
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(328085, { latestFilesIndexes: CREATE_LATEST_FILES }),
    ]);

    const answer = await launcherContentService.getProjects([328085]);

    expect(answer.projects[0]!.latestFiles).toEqual([
      {
        fileId: "7000001",
        fileName: "create-1.21.1-6.0.10.jar",
        gameVersion: "1.21.1",
        loader: "neoforge",
        releaseType: "release",
      },
      {
        fileId: "6000002",
        fileName: "create-1.20.1-6.0.9.jar",
        gameVersion: "1.20.1",
        loader: "forge",
        releaseType: "beta",
      },
    ]);
  });

  it("asks CurseForge nothing without ids", async () => {
    const answer = await launcherContentService.getProjects([]);

    expect(answer).toEqual({ projects: [], unknownProjectIds: [] });
    expect(getMods).not.toHaveBeenCalled();
  });

  it("answers 503 when CurseForge fails", async () => {
    vi.mocked(getMods).mockRejectedValue(new Error("down"));

    await expect(
      launcherContentService.getProjects([328085]),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
  });
});

describe("LauncherContentService.getProjectDetails", () => {
  const CREATE_DETAILS = {
    categories: [{ id: 412, name: "Technology", slug: "technology" }],
    screenshots: [
      {
        title: "Contraptions",
        thumbnailUrl: "https://media.forgecdn.net/attachments/thumb.png",
        url: "https://media.forgecdn.net/attachments/full.png",
      },
    ],
    downloadCount: 213407951,
    sourceUrl: "https://github.com/Creators-of-Create/Create",
    latestFilesIndexes: CREATE_LATEST_FILES,
  };

  it("answers the project as a lookup does, with what CurseForge tells beyond it", async () => {
    vi.mocked(getMods).mockResolvedValue([
      { ...createProject(), ...CREATE_DETAILS },
    ]);
    vi.mocked(getProjectDescription).mockResolvedValue("<p>Rotate!</p>");

    const details = await launcherContentService.getProjectDetails(328085);

    expect(getMods).toHaveBeenCalledWith([328085]);
    expect(getProjectDescription).toHaveBeenCalledWith(328085);
    expect(details).toEqual({
      source: "curseforge",
      id: "328085",
      slug: "create",
      kind: "mod",
      name: "Create",
      summary: "A synthetic test project",
      author: "vitest",
      iconUrl: null,
      url: CREATE_PAGE,
      description: "<p>Rotate!</p>",
      downloads: 213407951,
      categories: ["Technology"],
      links: {
        source: "https://github.com/Creators-of-Create/Create",
        issues: null,
        wiki: null,
      },
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
      gallery: ["https://media.forgecdn.net/attachments/full.png"],
    });
  });

  it.each([
    ["resourcepack", 12],
    ["shader", 6552],
  ] as const)("answers a %s", async (kind, classId) => {
    vi.mocked(getMods).mockResolvedValue([makeProjectData(555, { classId })]);
    vi.mocked(getProjectDescription).mockResolvedValue(null);

    const details = await launcherContentService.getProjectDetails(555);

    expect(details).toMatchObject({ id: "555", kind, description: null });
  });

  it.each([
    ["an empty one", ""],
    ["nothing but whitespace", " \n"],
    ["none", null],
  ])(
    "has no description when CurseForge holds %s",
    async (_label, description) => {
      vi.mocked(getMods).mockResolvedValue([createProject()]);
      vi.mocked(getProjectDescription).mockResolvedValue(description);

      const details = await launcherContentService.getProjectDetails(328085);

      expect(details.description).toBeNull();
    },
  );

  it.each([
    ["CurseForge does not know", () => []],
    [
      "is no mod, resource pack, shader or modpack",
      () => [makeProjectData(6945001, { classId: 6945 })],
    ],
  ])("answers 404 for a project that %s", async (_label, projects) => {
    vi.mocked(getMods).mockResolvedValue(projects());
    vi.mocked(getProjectDescription).mockResolvedValue(null);

    await expect(
      launcherContentService.getProjectDetails(6945001),
    ).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
  });

  it.each([
    [
      "the project lookup",
      () => vi.mocked(getMods).mockRejectedValue(new Error("down")),
    ],
    [
      "the description lookup",
      () =>
        vi.mocked(getProjectDescription).mockRejectedValue(new Error("down")),
    ],
  ])("answers 503 when %s fails", async (_label, fail) => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(getProjectDescription).mockResolvedValue("<p>Rotate!</p>");
    fail();

    await expect(
      launcherContentService.getProjectDetails(328085),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
  });
});

describe("LauncherContentService.listFiles", () => {
  it("answers one page of a project's files", async () => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(listProjectFiles).mockResolvedValue({
      files: [makeContentFile(), makeContentFile({ id: 7000002, sha1: null })],
      total: 11,
    });

    const listed = await launcherContentService.listFiles(328085, {
      minecraftVersion: "1.21.1",
      loader: "neoforge",
      page: 1,
      limit: 5,
    });

    expect(listProjectFiles).toHaveBeenCalledWith(328085, {
      gameVersion: "1.21.1",
      modLoaderType: 6,
      index: 5,
      pageSize: 5,
    });
    expect(listed.total).toBe(11);
    expect(listed.files).toHaveLength(1);
    expect(listed.files[0]).toMatchObject({
      source: "curseforge",
      projectId: "328085",
      id: "7000001",
      pageUrl: `${CREATE_PAGE}/files/7000001`,
      download: { servedBy: "curseforge" },
      gameVersions: ["1.21.1"],
      loaders: ["neoforge"],
    });
    expect(resolveFileDownloads).not.toHaveBeenCalled();
  });

  it("does not filter the files of a shader by loader", async () => {
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(6552001, { classId: 6552 }),
    ]);
    vi.mocked(listProjectFiles).mockResolvedValue({ files: [], total: 0 });

    await launcherContentService.listFiles(6552001, {
      loader: "neoforge",
      ...FIRST_PAGE,
    });

    expect(vi.mocked(listProjectFiles).mock.calls[0]?.[1]).toMatchObject({
      modLoaderType: null,
    });
  });

  it("answers 404 for a project CurseForge does not know", async () => {
    vi.mocked(getMods).mockResolvedValue([]);

    await expect(
      launcherContentService.listFiles(999999999, FIRST_PAGE),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "PROJECT_NOT_FOUND",
    });
    expect(listProjectFiles).not.toHaveBeenCalled();
  });

  it("resolves the blocked files in one lookup and answers what another source has for them", async () => {
    switchCdn(true);
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(listProjectFiles).mockResolvedValue({
      files: [
        makeContentFile({ downloadUrl: null }),
        makeContentFile({ id: 7000002 }),
        makeContentFile({ id: 7000003, downloadUrl: null }),
        makeContentFile({ id: 7000004, downloadUrl: null }),
      ],
      total: 4,
    });
    resolveDownloads({
      7000001: { source: "curseforge-cdn", url: BLOCKED_CDN_URL },
      7000004: { source: "modrinth", url: MODRINTH_URL },
    });

    const listed = await launcherContentService.listFiles(328085, FIRST_PAGE);

    expect(resolveFileDownloads).toHaveBeenCalledTimes(1);
    expect(resolveFileDownloads).toHaveBeenCalledWith(
      [7000001, 7000003, 7000004],
      { cdn: true, timeoutMs: 15_000 },
    );
    expect(listed.files.map((file) => file.download)).toEqual([
      { servedBy: "curseforge-cdn", url: BLOCKED_CDN_URL },
      {
        servedBy: "curseforge",
        url: "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
      },
      { servedBy: "manual", url: null },
      { servedBy: "modrinth", url: MODRINTH_URL },
    ]);
  });

  it("resolves the blocked files without the built CDN address while the flag is off", async () => {
    switchCdn(false);
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(listProjectFiles).mockResolvedValue({
      files: [makeContentFile({ downloadUrl: null })],
      total: 1,
    });

    const listed = await launcherContentService.listFiles(328085, FIRST_PAGE);

    expect(resolveFileDownloads).toHaveBeenCalledWith([7000001], {
      cdn: false,
      timeoutMs: 15_000,
    });
    expect(listed.files[0]?.download).toEqual({
      servedBy: "manual",
      url: null,
    });
  });
});

describe("LauncherContentService.getFile", () => {
  it("answers a file with its address, hash and dependencies", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([
      makeContentFile({
        dependencies: [{ projectId: 238222, required: true }],
      }),
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const file = await launcherContentService.getFile(7000001);

    expect(getContentFiles).toHaveBeenCalledWith([7000001]);
    expect(getMods).toHaveBeenCalledWith([328085]);
    expect(file).toMatchObject({
      id: "7000001",
      sha1: "0e97e49837bed766e6f28a4c95b04885d6acc353",
      pageUrl: `${CREATE_PAGE}/files/7000001`,
      download: {
        servedBy: "curseforge",
        url: "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
      },
      dependencies: [
        { source: "curseforge", projectId: "238222", required: true },
      ],
    });
  });

  describe("for a file CurseForge blocks", () => {
    beforeEach(() => {
      vi.mocked(getContentFiles).mockResolvedValue([
        makeContentFile({ downloadUrl: null }),
      ]);
      vi.mocked(getMods).mockResolvedValue([createProject()]);
    });

    it("answers the address the gateway resolves, in the launcher's pool", async () => {
      switchCdn(true);
      let pool: string | null = null;
      vi.mocked(resolveFileDownloads).mockImplementation(async () => {
        pool = currentContentPool();
        return new Map([
          [
            7000001,
            { source: "curseforge-cdn", url: BLOCKED_CDN_URL, retry: false },
          ],
        ]);
      });

      const file = await launcherContentService.getFile(7000001);

      expect(file.download).toEqual({
        servedBy: "curseforge-cdn",
        url: BLOCKED_CDN_URL,
      });
      expect(pool).toBe("launcher");
    });

    it("answers manual when no source has it", async () => {
      switchCdn(true);

      const file = await launcherContentService.getFile(7000001);

      expect(file.download).toEqual({ servedBy: "manual", url: null });
    });

    it("answers manual when the gateway cannot resolve it, without failing", async () => {
      switchCdn(true);
      vi.mocked(resolveFileDownloads).mockRejectedValue(refusal(12_500));

      const file = await launcherContentService.getFile(7000001);

      expect(file.download).toEqual({ servedBy: "manual", url: null });
    });

    it("reads the flag on every answer", async () => {
      switchCdn(false);
      await launcherContentService.getFile(7000001);
      switchCdn(true);
      await launcherContentService.getFile(7000001);

      expect(
        vi
          .mocked(resolveFileDownloads)
          .mock.calls.map(([, options]) => options),
      ).toEqual([
        { cdn: false, timeoutMs: 15_000 },
        { cdn: true, timeoutMs: 15_000 },
      ]);
    });
  });

  it.each([
    ["CurseForge does not know", () => []],
    ["belongs to another game", () => [makeContentFile({ gameId: 1 })]],
    ["has no SHA-1", () => [makeContentFile({ sha1: null })]],
  ])("answers 404 for a file that %s", async (_label, files) => {
    vi.mocked(getContentFiles).mockResolvedValue(files());
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    await expect(launcherContentService.getFile(7000001)).rejects.toMatchObject(
      { statusCode: 404, code: "FILE_NOT_FOUND" },
    );
  });

  it("answers 404 for a file of a project that is no mod, resource pack, shader or modpack", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([
      makeContentFile({ projectId: 6945001 }),
    ]);
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(6945001, { classId: 6945 }),
    ]);

    await expect(launcherContentService.getFile(7000001)).rejects.toMatchObject(
      { statusCode: 404, code: "FILE_NOT_FOUND" },
    );
  });
});

describe("LauncherContentService for modpacks", () => {
  it("searches the modpack class with the loader and Minecraft version", async () => {
    vi.mocked(searchProjects).mockResolvedValue({
      projects: [
        makeHit({
          id: 925200,
          classId: 4471,
          slug: "all-the-mods-10",
          name: "All the Mods 10",
          websiteUrl: `${PACK_PAGE}/`,
        }),
      ],
      total: 1,
    });

    const found = await launcherContentService.search({
      query: "all the mods",
      kind: "modpack",
      minecraftVersion: "1.21.1",
      loader: "neoforge",
      ...FIRST_PAGE,
    });

    expect(searchProjects).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: 4471,
        gameVersion: "1.21.1",
        modLoaderType: 6,
      }),
    );
    expect(found.projects).toEqual([
      expect.objectContaining({
        id: "925200",
        kind: "modpack",
        url: PACK_PAGE,
      }),
    ]);
  });

  it("lists the categories of the modpack class", async () => {
    vi.mocked(listCategories).mockResolvedValue([
      {
        id: 4472,
        name: "Tech",
        slug: "tech",
        iconUrl: null,
        parentCategoryId: 4471,
      },
    ]);

    const categories = await launcherContentService.listCategories("modpack");

    expect(listCategories).toHaveBeenCalledWith(4471);
    expect(categories).toEqual([
      { id: "4472", name: "Tech", slug: "tech", iconUrl: null, parentId: null },
    ]);
  });

  it("answers a modpack by id and in full, with its picture and summary", async () => {
    vi.mocked(getMods).mockResolvedValue([packProject()]);
    vi.mocked(getProjectDescription).mockResolvedValue("<p>Everything</p>");

    const { projects, unknownProjectIds } =
      await launcherContentService.getProjects([925200]);
    const details = await launcherContentService.getProjectDetails(925200);

    expect(unknownProjectIds).toEqual([]);
    expect(projects[0]).toMatchObject({
      id: "925200",
      kind: "modpack",
      summary: "The kitchen sink for 1.21.1",
      iconUrl: "https://media.forgecdn.net/avatars/atm10.png",
      url: PACK_PAGE,
    });
    expect(details).toMatchObject({
      kind: "modpack",
      description: "<p>Everything</p>",
    });
  });

  it("lists the files of a modpack for a loader", async () => {
    vi.mocked(getMods).mockResolvedValue([packProject()]);
    vi.mocked(listProjectFiles).mockResolvedValue({
      files: [packZip()],
      total: 1,
    });

    const listed = await launcherContentService.listFiles(925200, {
      minecraftVersion: "1.21.1",
      loader: "neoforge",
      ...FIRST_PAGE,
    });

    expect(listProjectFiles).toHaveBeenCalledWith(
      925200,
      expect.objectContaining({ gameVersion: "1.21.1", modLoaderType: 6 }),
    );
    expect(listed.files[0]).toMatchObject({
      id: "6500000",
      pageUrl: `${PACK_PAGE}/files/6500000`,
    });
  });

  it("answers the zip of a modpack with its address and SHA-1", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([packZip()]);
    vi.mocked(getMods).mockResolvedValue([packProject()]);

    const file = await launcherContentService.getFile(6500000);

    expect(file).toMatchObject({
      projectId: "925200",
      fileName: "All the Mods 10-2.40.zip",
      size: 2481204,
      sha1: "9a1c03ad1b5f9c4f3c0e1f6a3b2d4e5f60718293",
      download: {
        servedBy: "curseforge",
        url: "https://edge.forgecdn.net/files/6500/0/All%20the%20Mods%2010-2.40.zip",
      },
    });
  });
});

describe("LauncherContentService.getFiles", () => {
  const FLYWHEEL_PAGE =
    "https://www.curseforge.com/minecraft/mc-mods/vitest-mod-486392";

  function serveFiles(files: CurseForgeContentFile[]) {
    vi.mocked(getContentFiles).mockImplementation(async (ids) =>
      files.filter((file) => ids.includes(file.id)),
    );
  }

  function serveProjects(projects: CurseForgeProjectData[]) {
    vi.mocked(getMods).mockImplementation(async (ids) =>
      projects.filter((project) => ids.includes(project.id)),
    );
  }

  it("answers each file as a single lookup does, in the order asked, and names the ids it cannot answer", async () => {
    serveFiles([
      makeContentFile(),
      makeContentFile({ id: 7000002, projectId: 486392 }),
      makeContentFile({ id: 7000003, sha1: null }),
      makeContentFile({ id: 7000004, gameId: 1 }),
      makeContentFile({ id: 7000005, projectId: 6945001 }),
    ]);
    serveProjects([
      createProject(),
      makeProjectData(486392),
      makeProjectData(6945001, { classId: 6945 }),
    ]);

    const answer = await launcherContentService.getFiles([
      7000002, 7000003, 7000001, 7000004, 7000005, 7999999, 7000002,
    ]);

    expect(getContentFiles).toHaveBeenCalledTimes(1);
    expect(getContentFiles).toHaveBeenCalledWith([
      7000002, 7000003, 7000001, 7000004, 7000005, 7999999,
    ]);
    expect(getMods).toHaveBeenCalledTimes(1);
    expect(getMods).toHaveBeenCalledWith([328085, 486392, 6945001]);
    expect(answer.files.map((file) => file.id)).toEqual(["7000002", "7000001"]);
    expect(answer.files[0]).toMatchObject({
      projectId: "486392",
      pageUrl: `${FLYWHEEL_PAGE}/files/7000002`,
      size: 19123767,
      sha1: "0e97e49837bed766e6f28a4c95b04885d6acc353",
      download: { servedBy: "curseforge" },
    });
    expect(answer.unknownFileIds).toEqual([
      "7000003",
      "7000004",
      "7000005",
      "7999999",
    ]);
  });

  it("answers what a single lookup answers for the same file", async () => {
    serveFiles([makeContentFile()]);
    serveProjects([createProject()]);

    const { files } = await launcherContentService.getFiles([7000001]);

    expect(files).toEqual([await launcherContentService.getFile(7000001)]);
  });

  it("resolves the blocked files in one lookup", async () => {
    switchCdn(true);
    serveFiles([
      makeContentFile({ downloadUrl: null }),
      makeContentFile({ id: 7000002 }),
      makeContentFile({ id: 7000003, downloadUrl: null }),
    ]);
    serveProjects([createProject()]);
    resolveDownloads({
      7000001: { source: "curseforge-cdn", url: BLOCKED_CDN_URL },
    });

    const { files } = await launcherContentService.getFiles([
      7000001, 7000002, 7000003,
    ]);

    expect(files.map((file) => file.download)).toEqual([
      { servedBy: "curseforge-cdn", url: BLOCKED_CDN_URL },
      {
        servedBy: "curseforge",
        url: "https://edge.forgecdn.net/files/7000/1/create-1.21.1-6.0.10.jar",
      },
      { servedBy: "manual", url: null },
    ]);
    expect(resolveFileDownloads).toHaveBeenCalledTimes(1);
    expect(vi.mocked(resolveFileDownloads).mock.calls[0]![0]).toEqual([
      7000001, 7000003,
    ]);
  });

  it("asks for the projects of the files it knows only", async () => {
    serveFiles([]);

    const answer = await launcherContentService.getFiles([7999999]);

    expect(answer).toEqual({ files: [], unknownFileIds: ["7999999"] });
    expect(getMods).not.toHaveBeenCalled();
  });

  it("answers 503 when CurseForge fails", async () => {
    vi.mocked(getContentFiles).mockRejectedValue(
      new Error("CurseForge getContentFiles failed"),
    );

    await expect(
      launcherContentService.getFiles([7000001]),
    ).rejects.toMatchObject({ statusCode: 503, code: "CONTENT_UNAVAILABLE" });
  });
});

describe("LauncherContentService.getFileChangelog", () => {
  const CHANGELOG = "<p>Fixed the crash on load</p>";

  beforeEach(() => {
    vi.mocked(getContentFiles).mockResolvedValue([makeContentFile()]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(getFileChangelog).mockResolvedValue(CHANGELOG);
  });

  it("looks the file up for its project and answers the changelog of the file", async () => {
    const changelog = await launcherContentService.getFileChangelog(7000001);

    expect(getContentFiles).toHaveBeenCalledWith([7000001]);
    expect(getFileChangelog).toHaveBeenCalledWith(328085, 7000001);
    expect(changelog).toBe(CHANGELOG);
  });

  it.each([
    ["empty", ""],
    ["nothing but whitespace", " \n"],
  ])("answers null for a file whose changelog is %s", async (_label, html) => {
    vi.mocked(getFileChangelog).mockResolvedValue(html);

    expect(await launcherContentService.getFileChangelog(7000001)).toBeNull();
  });

  it("asks under the project the caller names, without looking the file up", async () => {
    const changelog = await launcherContentService.getFileChangelog(
      7000001,
      328085,
    );

    expect(changelog).toBe(CHANGELOG);
    expect(getMods).toHaveBeenCalledWith([328085]);
    expect(getFileChangelog).toHaveBeenCalledWith(328085, 7000001);
    expect(getContentFiles).not.toHaveBeenCalled();
  });

  it("answers 404 for a file that is no file of the project named", async () => {
    vi.mocked(getMods).mockImplementation(async (ids) =>
      ids.map((id) => makeProjectData(id)),
    );
    vi.mocked(getFileChangelog).mockImplementation(async (projectId) =>
      projectId === 328085 ? CHANGELOG : null,
    );

    await expect(
      launcherContentService.getFileChangelog(7000001, 238222),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    expect(await launcherContentService.getFileChangelog(7000001, 328085)).toBe(
      CHANGELOG,
    );
  });

  it.each([
    ["CurseForge does not know", () => []],
    [
      "is no mod, resource pack, shader or modpack",
      () => [makeProjectData(6945001, { classId: 6945 })],
    ],
  ])(
    "answers 404 when the project named %s, without asking for a changelog",
    async (_label, projects) => {
      vi.mocked(getMods).mockResolvedValue(projects());

      await expect(
        launcherContentService.getFileChangelog(7000001, 6945001),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
      expect(getFileChangelog).not.toHaveBeenCalled();
      expect(getContentFiles).not.toHaveBeenCalled();
    },
  );

  it("holds a file to the rules of a file lookup only when no project is named", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([
      makeContentFile({ sha1: null }),
    ]);

    await expect(
      launcherContentService.getFileChangelog(7000001),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
    expect(getFileChangelog).not.toHaveBeenCalled();

    expect(await launcherContentService.getFileChangelog(7000001, 328085)).toBe(
      CHANGELOG,
    );
  });

  it("answers 404 when the file is gone by the time its changelog is asked for", async () => {
    vi.mocked(getFileChangelog).mockResolvedValue(null);

    await expect(
      launcherContentService.getFileChangelog(7000001),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
  });

  it("asks for no changelog when only the file is asked for", async () => {
    const file = await launcherContentService.getFile(7000001);

    expect(file.id).toBe("7000001");
    expect(getFileChangelog).not.toHaveBeenCalled();
  });

  it.each([
    ["CurseForge does not know", () => []],
    ["belongs to another game", () => [makeContentFile({ gameId: 1 })]],
  ])(
    "answers 404 for a file that %s, without asking for a changelog",
    async (_label, files) => {
      vi.mocked(getContentFiles).mockResolvedValue(files());

      await expect(
        launcherContentService.getFileChangelog(7000001),
      ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
      expect(getFileChangelog).not.toHaveBeenCalled();
    },
  );

  it("answers 503 when CurseForge fails", async () => {
    vi.mocked(getFileChangelog).mockRejectedValue(new Error("down"));

    await expect(
      launcherContentService.getFileChangelog(7000001),
    ).rejects.toMatchObject({ statusCode: 503, code: "CONTENT_UNAVAILABLE" });
  });
});

describe("LauncherContentService.identifyFingerprints", () => {
  it("answers the project and the file behind each fingerprint and names the ones it does not know", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 522093599, file: makeContentFile() },
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const answer = await launcherContentService.identifyFingerprints([
      522093599, 1, 522093599,
    ]);

    expect(matchFingerprints).toHaveBeenCalledWith([522093599, 1]);
    expect(getMods).toHaveBeenCalledWith([328085]);
    expect(answer.unmatchedFingerprints).toEqual([1]);
    expect(answer.matches).toHaveLength(1);
    expect(answer.matches[0]).toMatchObject({
      fingerprint: 522093599,
      project: { source: "curseforge", id: "328085", kind: "mod" },
      file: {
        projectId: "328085",
        id: "7000001",
        sha1: "0e97e49837bed766e6f28a4c95b04885d6acc353",
        pageUrl: CREATE_PAGE + "/files/7000001",
        download: { servedBy: "curseforge" },
      },
    });
  });

  it("answers the project of a match as the search and the pack files do, without its newest files", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 522093599, file: makeContentFile() },
    ]);
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(328085, {
        slug: "create",
        name: "Create",
        websiteUrl: CREATE_PAGE,
        latestFilesIndexes: CREATE_LATEST_FILES,
      }),
    ]);

    const answer = await launcherContentService.identifyFingerprints([
      522093599,
    ]);

    expect(answer.matches[0]!.project).toEqual({
      source: "curseforge",
      id: "328085",
      slug: "create",
      kind: "mod",
      name: "Create",
      summary: "A synthetic test project",
      author: "vitest",
      iconUrl: null,
      url: CREATE_PAGE,
    });
  });

  it("keeps the order the fingerprints were asked in", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 30, file: makeContentFile({ id: 7000030 }) },
      { fingerprint: 10, file: makeContentFile({ id: 7000010 }) },
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const answer = await launcherContentService.identifyFingerprints([
      10, 20, 30, 40,
    ]);

    expect(answer.matches.map((match) => match.fingerprint)).toEqual([10, 30]);
    expect(answer.unmatchedFingerprints).toEqual([20, 40]);
  });

  it("answers no match without failing when CurseForge knows none of them", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([]);

    const answer = await launcherContentService.identifyFingerprints([1, 2]);

    expect(answer).toEqual({ matches: [], unmatchedFingerprints: [1, 2] });
    expect(getMods).not.toHaveBeenCalled();
  });

  it("asks CurseForge nothing without fingerprints", async () => {
    const answer = await launcherContentService.identifyFingerprints([]);

    expect(answer).toEqual({ matches: [], unmatchedFingerprints: [] });
    expect(matchFingerprints).not.toHaveBeenCalled();
  });

  it.each([
    ["has no SHA-1", makeContentFile({ sha1: null }), createProject()],
    [
      "belongs to no mod, resource pack, shader or modpack",
      makeContentFile({ projectId: 6945001 }),
      makeProjectData(6945001, { classId: 6945 }),
    ],
  ])("counts a file that %s as unmatched", async (_label, file, project) => {
    vi.mocked(matchFingerprints).mockResolvedValue([{ fingerprint: 7, file }]);
    vi.mocked(getMods).mockResolvedValue([project]);

    const answer = await launcherContentService.identifyFingerprints([7]);

    expect(answer).toEqual({ matches: [], unmatchedFingerprints: [7] });
  });

  it("takes the first file it can answer when several share a fingerprint", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 7, file: makeContentFile({ id: 7000002, sha1: null }) },
      { fingerprint: 7, file: makeContentFile({ id: 7000003 }) },
      { fingerprint: 7, file: makeContentFile({ id: 7000004 }) },
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const answer = await launcherContentService.identifyFingerprints([7]);

    expect(answer.matches.map((match) => match.file.id)).toEqual(["7000003"]);
  });

  it("answers 503 when CurseForge fails", async () => {
    vi.mocked(matchFingerprints).mockRejectedValue(new Error("down"));

    await expect(
      launcherContentService.identifyFingerprints([10]),
    ).rejects.toMatchObject({ statusCode: 503, code: "CONTENT_UNAVAILABLE" });
  });
});

describe("LauncherContentService when the gateway refuses a call", () => {
  const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

  it("answers 503 with a Retry-After when the budget of the minute is spent", async () => {
    vi.mocked(searchProjects).mockRejectedValue(refusal(12_500));

    await expect(launcherContentService.search(search)).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
      headers: { "Retry-After": "13" },
    });
  });

  it("answers a Retry-After of at least a second", async () => {
    vi.mocked(searchProjects).mockRejectedValue(refusal(400));

    await expect(launcherContentService.search(search)).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
      headers: { "Retry-After": "1" },
    });
  });

  it("answers 503 without a Retry-After when the gateway could not ask CurseForge", async () => {
    vi.mocked(searchProjects).mockRejectedValue(refusal(null));

    const error = await launcherContentService.search(search).catch((e) => e);

    expect(error).toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
    expect(error.headers).toBeUndefined();
  });
});
