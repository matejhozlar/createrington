import { describe, it, expect, beforeEach, vi } from "vitest";
import type { KeyValueStore } from "@/services/key-value-store";

const { stores } = vi.hoisted(() => ({
  stores: {
    current: null as unknown as KeyValueStore,
    create: (): KeyValueStore => {
      throw new Error("not ready");
    },
  },
}));

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
  };
});
vi.mock("@/services/key-value-store", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/key-value-store")>();
  stores.create = () => new actual.MemoryKeyValueStore();
  return {
    ...actual,
    keyValueStore: {
      get: (key: string) => stores.current.get(key),
      set: (key: string, value: string, ttlMs: number) =>
        stores.current.set(key, value, ttlMs),
    },
  };
});

import {
  getContentFiles,
  getFileChangelog,
  getMods,
  getProjectDescription,
  listCategories,
  listProjectFiles,
  matchFingerprints,
  searchProjects,
  type CurseForgeContentFile,
  type CurseForgeProjectData,
  type CurseForgeProjectHit,
} from "@/services/curseforge";
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

beforeEach(() => {
  vi.resetAllMocks();
  stores.current = stores.create();
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

  it("asks CurseForge once for the same search, whatever the case of the text", async () => {
    vi.mocked(searchProjects).mockResolvedValue({
      projects: [makeHit()],
      total: 1,
    });
    const search = { kind: "mod", ...FIRST_PAGE } as const;

    const first = await launcherContentService.search({
      query: "create",
      ...search,
    });
    const second = await launcherContentService.search({
      query: "Create",
      ...search,
    });

    expect(second).toEqual(first);
    expect(searchProjects).toHaveBeenCalledTimes(1);
  });

  it("asks again for another page, kind, version or loader", async () => {
    vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });
    const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

    await launcherContentService.search(search);
    await launcherContentService.search({ ...search, page: 1 });
    await launcherContentService.search({ ...search, kind: "shader" });
    await launcherContentService.search({
      ...search,
      minecraftVersion: "1.21.1",
    });
    await launcherContentService.search({ ...search, loader: "fabric" });

    expect(searchProjects).toHaveBeenCalledTimes(5);
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

  it("asks CurseForge for the categories and the sort order it is given", async () => {
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

  it("asks again for another category or sort order", async () => {
    vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });
    const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

    await launcherContentService.search(search);
    await launcherContentService.search({ ...search, categoryIds: [412] });
    await launcherContentService.search({ ...search, categoryIds: [420] });
    await launcherContentService.search({
      ...search,
      categoryIds: [412, 420],
    });
    await launcherContentService.search({ ...search, sort: "downloads" });
    await launcherContentService.search({ ...search, sort: "updated" });

    expect(searchProjects).toHaveBeenCalledTimes(6);
  });

  it("asks CurseForge once for the same categories in another order, and for relevance as for no sort order", async () => {
    vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });
    const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

    await launcherContentService.search({
      ...search,
      categoryIds: [412, 420],
    });
    await launcherContentService.search({
      ...search,
      categoryIds: [420, 412],
      sort: "relevance",
    });

    expect(searchProjects).toHaveBeenCalledTimes(1);
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

  it("answers 503 when CurseForge fails, and asks again next time", async () => {
    vi.mocked(searchProjects)
      .mockRejectedValueOnce(new Error("CurseForge search failed (500)"))
      .mockResolvedValueOnce({ projects: [makeHit()], total: 1 });
    const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

    await expect(launcherContentService.search(search)).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
    expect((await launcherContentService.search(search)).projects).toHaveLength(
      1,
    );
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

  it("asks CurseForge once per kind", async () => {
    vi.mocked(listCategories).mockResolvedValue([technology]);

    await launcherContentService.listCategories("mod");
    await launcherContentService.listCategories("mod");
    await launcherContentService.listCategories("shader");
    await launcherContentService.listCategories("resourcepack");

    expect(
      vi.mocked(listCategories).mock.calls.map(([classId]) => classId),
    ).toEqual([6, 6552, 12]);
  });

  it("answers 503 when CurseForge fails, and asks again next time", async () => {
    vi.mocked(listCategories)
      .mockRejectedValueOnce(new Error("CurseForge categories failed (500)"))
      .mockResolvedValueOnce([technology]);

    await expect(
      launcherContentService.listCategories("mod"),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
    expect(await launcherContentService.listCategories("mod")).toHaveLength(1);
  });

  it("answers 503 when CurseForge lists no categories, and asks again next time", async () => {
    vi.mocked(listCategories)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([technology]);

    await expect(
      launcherContentService.listCategories("mod"),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "CONTENT_UNAVAILABLE",
    });
    expect(await launcherContentService.listCategories("mod")).toHaveLength(1);
    expect(listCategories).toHaveBeenCalledTimes(2);
  });
});

describe("LauncherContentService.getProjects", () => {
  it("answers the known projects and names the ids it does not know", async () => {
    vi.mocked(getMods).mockResolvedValue([
      createProject(),
      makeProjectData(4471001, { classId: 4471 }),
    ]);

    const answer = await launcherContentService.getProjects([
      328085, 4471001, 999999999, 328085,
    ]);

    expect(getMods).toHaveBeenCalledWith([328085, 4471001, 999999999]);
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
    expect(answer.unknownProjectIds).toEqual(["4471001", "999999999"]);
  });

  it("answers the newest file of a project per Minecraft version and loader", async () => {
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(328085, { latestFilesIndexes: CREATE_LATEST_FILES }),
    ]);

    const first = await launcherContentService.getProjects([328085]);
    const second = await launcherContentService.getProjects([328085]);

    expect(getMods).toHaveBeenCalledTimes(1);
    expect(first.projects[0].latestFiles).toEqual([
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
    expect(second).toEqual(first);
  });

  it("only asks CurseForge about projects it has not just looked up", async () => {
    vi.mocked(getMods)
      .mockResolvedValueOnce([createProject()])
      .mockResolvedValueOnce([makeProjectData(238222)]);

    await launcherContentService.getProjects([328085, 999999999]);
    const answer = await launcherContentService.getProjects([
      328085, 999999999, 238222,
    ]);

    expect(getMods).toHaveBeenCalledTimes(2);
    expect(getMods).toHaveBeenLastCalledWith([238222]);
    expect(answer.projects.map((project) => project.id)).toEqual([
      "328085",
      "238222",
    ]);
    expect(answer.unknownProjectIds).toEqual(["999999999"]);
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

  it("asks CurseForge once for the same project", async () => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(getProjectDescription).mockResolvedValue("<p>Rotate!</p>");

    const first = await launcherContentService.getProjectDetails(328085);
    const second = await launcherContentService.getProjectDetails(328085);

    expect(second).toEqual(first);
    expect(getMods).toHaveBeenCalledTimes(1);
    expect(getProjectDescription).toHaveBeenCalledTimes(1);
  });

  it("shares one lookup between players who open the same project at the same time", async () => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(getProjectDescription).mockResolvedValue("<p>Rotate!</p>");

    const [first, second] = await Promise.all([
      launcherContentService.getProjectDetails(328085),
      launcherContentService.getProjectDetails(328085),
    ]);

    expect(second).toEqual(first);
    expect(getMods).toHaveBeenCalledTimes(1);
    expect(getProjectDescription).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["CurseForge does not know", () => []],
    [
      "is no mod, resource pack or shader",
      () => [makeProjectData(4471001, { classId: 4471 })],
    ],
  ])("answers 404 for a project that %s", async (_label, projects) => {
    vi.mocked(getMods).mockResolvedValue(projects());
    vi.mocked(getProjectDescription).mockResolvedValue(null);

    await expect(
      launcherContentService.getProjectDetails(4471001),
    ).rejects.toMatchObject({ statusCode: 404, code: "PROJECT_NOT_FOUND" });
  });

  it("forgets an unknown project sooner than a known one", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(getMods).mockImplementation(async ([id]) =>
        id === 328085 ? [createProject()] : [],
      );
      vi.mocked(getProjectDescription).mockResolvedValue(null);
      const unknown = () =>
        launcherContentService.getProjectDetails(999999999).catch(() => null);

      await launcherContentService.getProjectDetails(328085);
      await unknown();
      await unknown();
      expect(getMods).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(5 * 60_000);
      await launcherContentService.getProjectDetails(328085);
      await unknown();

      expect(vi.mocked(getMods).mock.calls).toEqual([
        [[328085]],
        [[999999999]],
        [[999999999]],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    [
      "the project lookup",
      () => vi.mocked(getMods).mockRejectedValueOnce(new Error("down")),
    ],
    [
      "the description lookup",
      () =>
        vi
          .mocked(getProjectDescription)
          .mockRejectedValueOnce(new Error("down")),
    ],
  ])(
    "answers 503 when %s fails, and asks again next time",
    async (_label, fail) => {
      vi.mocked(getMods).mockResolvedValue([createProject()]);
      vi.mocked(getProjectDescription).mockResolvedValue("<p>Rotate!</p>");
      fail();

      await expect(
        launcherContentService.getProjectDetails(328085),
      ).rejects.toMatchObject({
        statusCode: 503,
        code: "CONTENT_UNAVAILABLE",
      });
      expect(
        (await launcherContentService.getProjectDetails(328085)).description,
      ).toBe("<p>Rotate!</p>");
    },
  );
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
  });

  it("asks CurseForge once for the same page", async () => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(listProjectFiles).mockResolvedValue({
      files: [makeContentFile()],
      total: 1,
    });

    await launcherContentService.listFiles(328085, FIRST_PAGE);
    await launcherContentService.listFiles(328085, FIRST_PAGE);

    expect(listProjectFiles).toHaveBeenCalledTimes(1);
    expect(getMods).toHaveBeenCalledTimes(1);
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

  it("answers a file CurseForge blocks as manual, without asking another source", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([
      makeContentFile({ downloadUrl: null }),
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const file = await launcherContentService.getFile(7000001);

    expect(file.download).toEqual({ servedBy: "manual", url: null });
  });

  it("asks CurseForge once for the same file", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([makeContentFile()]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    await launcherContentService.getFile(7000001);
    await launcherContentService.getFile(7000001);

    expect(getContentFiles).toHaveBeenCalledTimes(1);
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

  it("answers 404 for a file of a project that is no mod, resource pack or shader", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([
      makeContentFile({ projectId: 4471001 }),
    ]);
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(4471001, { classId: 4471 }),
    ]);

    await expect(launcherContentService.getFile(7000001)).rejects.toMatchObject(
      { statusCode: 404, code: "FILE_NOT_FOUND" },
    );
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
  ])(
    "answers null for a file whose changelog is %s, and does not ask again",
    async (_label, html) => {
      vi.mocked(getFileChangelog).mockResolvedValue(html);

      expect(await launcherContentService.getFileChangelog(7000001)).toBeNull();
      expect(await launcherContentService.getFileChangelog(7000001)).toBeNull();
      expect(getFileChangelog).toHaveBeenCalledTimes(1);
    },
  );

  it("asks under the project the caller names, without looking the file up", async () => {
    const changelog = await launcherContentService.getFileChangelog(
      7000001,
      328085,
    );

    expect(changelog).toBe(CHANGELOG);
    expect(getFileChangelog).toHaveBeenCalledWith(328085, 7000001);
    expect(getContentFiles).not.toHaveBeenCalled();
  });

  it("asks CurseForge for the changelog alone when the project named was just looked up", async () => {
    await launcherContentService.getProjects([328085]);
    vi.mocked(getMods).mockClear();

    await launcherContentService.getFileChangelog(7000001, 328085);

    expect(getMods).not.toHaveBeenCalled();
    expect(getContentFiles).not.toHaveBeenCalled();
    expect(getFileChangelog).toHaveBeenCalledTimes(1);
  });

  it("answers 404 for a file that is no file of the project named, and keeps nothing", async () => {
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
    expect(await launcherContentService.getFileChangelog(7000001)).toBe(
      CHANGELOG,
    );
    expect(getFileChangelog).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["CurseForge does not know", () => []],
    [
      "is no mod, resource pack or shader",
      () => [makeProjectData(4471001, { classId: 4471 })],
    ],
  ])(
    "answers 404 when the project named %s, without asking for a changelog",
    async (_label, projects) => {
      vi.mocked(getMods).mockResolvedValue(projects());

      await expect(
        launcherContentService.getFileChangelog(7000001, 4471001),
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
    expect(await launcherContentService.getFileChangelog(7000001)).toBe(
      CHANGELOG,
    );
    expect(getFileChangelog).toHaveBeenCalledTimes(1);
  });

  it("answers 404 when the file is gone by the time its changelog is asked for", async () => {
    vi.mocked(getFileChangelog).mockResolvedValue(null);

    await expect(
      launcherContentService.getFileChangelog(7000001),
    ).rejects.toMatchObject({ statusCode: 404, code: "FILE_NOT_FOUND" });
  });

  it("asks CurseForge once for the same changelog, also after the file itself was forgotten", async () => {
    vi.useFakeTimers();
    try {
      await launcherContentService.getFileChangelog(7000001);
      vi.advanceTimersByTime(60 * 60_000);
      const again = await launcherContentService.getFileChangelog(7000001);

      expect(again).toBe(CHANGELOG);
      expect(getFileChangelog).toHaveBeenCalledTimes(1);
      expect(getContentFiles).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shares one lookup between players who open the same changelog at the same time", async () => {
    const [first, second] = await Promise.all([
      launcherContentService.getFileChangelog(7000001),
      launcherContentService.getFileChangelog(7000001),
    ]);

    expect([first, second]).toEqual([CHANGELOG, CHANGELOG]);
    expect(getFileChangelog).toHaveBeenCalledTimes(1);
  });

  it("does not look up a file again that was just answered", async () => {
    await launcherContentService.getFile(7000001);
    await launcherContentService.getFileChangelog(7000001);

    expect(getContentFiles).toHaveBeenCalledTimes(1);
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

  it("answers 503 when CurseForge fails, and asks again next time", async () => {
    vi.mocked(getFileChangelog)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(CHANGELOG);

    await expect(
      launcherContentService.getFileChangelog(7000001),
    ).rejects.toMatchObject({ statusCode: 503, code: "CONTENT_UNAVAILABLE" });
    expect(await launcherContentService.getFileChangelog(7000001)).toBe(
      CHANGELOG,
    );
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

    expect(answer.matches[0].project).toEqual({
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

  it.each([
    ["has no SHA-1", makeContentFile({ sha1: null }), createProject()],
    [
      "belongs to no mod, resource pack or shader",
      makeContentFile({ projectId: 4471001 }),
      makeProjectData(4471001, { classId: 4471 }),
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

  it("only asks CurseForge about fingerprints it has not just looked up", async () => {
    vi.mocked(matchFingerprints)
      .mockResolvedValueOnce([
        { fingerprint: 10, file: makeContentFile({ id: 7000010 }) },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    await launcherContentService.identifyFingerprints([10, 20]);
    const answer = await launcherContentService.identifyFingerprints([
      10, 20, 30,
    ]);

    expect(matchFingerprints).toHaveBeenCalledTimes(2);
    expect(matchFingerprints).toHaveBeenLastCalledWith([30]);
    expect(getMods).toHaveBeenCalledTimes(1);
    expect(answer.matches.map((match) => match.fingerprint)).toEqual([10]);
    expect(answer.unmatchedFingerprints).toEqual([20, 30]);
  });

  it("asks CurseForge nothing when every fingerprint was just looked up", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 10, file: makeContentFile() },
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const first = await launcherContentService.identifyFingerprints([10, 20]);
    const second = await launcherContentService.identifyFingerprints([10, 20]);

    expect(second).toEqual(first);
    expect(matchFingerprints).toHaveBeenCalledTimes(1);
  });

  it("answers an identified file by its id without asking CurseForge again", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 10, file: makeContentFile() },
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const answer = await launcherContentService.identifyFingerprints([10]);
    const file = await launcherContentService.getFile(7000001);

    expect(file).toEqual(answer.matches[0]?.file);
    expect(getContentFiles).not.toHaveBeenCalled();
  });

  it("answers 503 when CurseForge fails, and asks again next time", async () => {
    vi.mocked(matchFingerprints)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce([{ fingerprint: 10, file: makeContentFile() }]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    await expect(
      launcherContentService.identifyFingerprints([10]),
    ).rejects.toMatchObject({ statusCode: 503, code: "CONTENT_UNAVAILABLE" });
    expect(
      (await launcherContentService.identifyFingerprints([10])).matches,
    ).toHaveLength(1);
  });
});

describe("LauncherContentService caching", () => {
  it("asks CurseForge once for a shader search whatever loader is named", async () => {
    vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });
    const search = { query: "bsl", kind: "shader", ...FIRST_PAGE } as const;

    await launcherContentService.search({ ...search, loader: "neoforge" });
    await launcherContentService.search({ ...search, loader: "fabric" });
    await launcherContentService.search(search);

    expect(searchProjects).toHaveBeenCalledTimes(1);
  });

  it("asks CurseForge once for a shader's files whatever loader is named", async () => {
    vi.mocked(getMods).mockResolvedValue([
      makeProjectData(6552001, { classId: 6552 }),
    ]);
    vi.mocked(listProjectFiles).mockResolvedValue({ files: [], total: 0 });

    await launcherContentService.listFiles(6552001, {
      loader: "neoforge",
      ...FIRST_PAGE,
    });
    await launcherContentService.listFiles(6552001, {
      loader: "fabric",
      ...FIRST_PAGE,
    });

    expect(listProjectFiles).toHaveBeenCalledTimes(1);
  });

  it("still asks per loader for a mod", async () => {
    vi.mocked(searchProjects).mockResolvedValue({ projects: [], total: 0 });
    const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

    await launcherContentService.search({ ...search, loader: "neoforge" });
    await launcherContentService.search({ ...search, loader: "fabric" });

    expect(searchProjects).toHaveBeenCalledTimes(2);
  });

  it("shares one CurseForge call between lookups of the same project at the same time", async () => {
    vi.mocked(getMods).mockImplementation(async (ids) =>
      ids.map((id) => makeProjectData(id)),
    );

    const [first, second] = await Promise.all([
      launcherContentService.getProjects([328085]),
      launcherContentService.getProjects([328085, 238222]),
    ]);

    expect(vi.mocked(getMods).mock.calls).toEqual([[[328085]], [[238222]]]);
    expect(first.projects.map((project) => project.id)).toEqual(["328085"]);
    expect(second.projects.map((project) => project.id)).toEqual([
      "328085",
      "238222",
    ]);
  });

  it("fails every lookup that shared a failed call, and asks again next time", async () => {
    vi.mocked(getMods)
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue([createProject()]);

    const results = await Promise.allSettled([
      launcherContentService.getProjects([328085]),
      launcherContentService.getProjects([328085]),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    expect(getMods).toHaveBeenCalledTimes(1);
    expect(
      (await launcherContentService.getProjects([328085])).projects,
    ).toHaveLength(1);
  });
});

describe("LauncherContentService with a store that fails", () => {
  beforeEach(() => {
    stores.current = {
      get: async () => {
        throw new Error("store down");
      },
      set: async () => {
        throw new Error("store down");
      },
    };
  });

  it("still answers a search, from CurseForge every time", async () => {
    vi.mocked(searchProjects).mockResolvedValue({
      projects: [makeHit()],
      total: 1,
    });
    const search = { query: "create", kind: "mod", ...FIRST_PAGE } as const;

    expect((await launcherContentService.search(search)).projects).toHaveLength(
      1,
    );
    expect((await launcherContentService.search(search)).projects).toHaveLength(
      1,
    );
    expect(searchProjects).toHaveBeenCalledTimes(2);
  });

  it("still answers one project in full", async () => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(getProjectDescription).mockResolvedValue("<p>Rotate!</p>");

    expect(
      (await launcherContentService.getProjectDetails(328085)).description,
    ).toBe("<p>Rotate!</p>");
  });

  it("still answers the changelog of a file", async () => {
    vi.mocked(getContentFiles).mockResolvedValue([makeContentFile()]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(getFileChangelog).mockResolvedValue("<p>Fixed the crash</p>");

    expect(await launcherContentService.getFileChangelog(7000001)).toBe(
      "<p>Fixed the crash</p>",
    );
  });

  it("still answers projects, files and a single file", async () => {
    vi.mocked(getMods).mockResolvedValue([createProject()]);
    vi.mocked(listProjectFiles).mockResolvedValue({
      files: [makeContentFile()],
      total: 1,
    });
    vi.mocked(getContentFiles).mockResolvedValue([makeContentFile()]);

    expect(
      (await launcherContentService.getProjects([328085])).projects,
    ).toHaveLength(1);
    expect(
      (await launcherContentService.listFiles(328085, FIRST_PAGE)).files,
    ).toHaveLength(1);
    expect((await launcherContentService.getFile(7000001)).id).toBe("7000001");
  });

  it("still identifies fingerprints, with one call for the files and one for the projects", async () => {
    vi.mocked(matchFingerprints).mockResolvedValue([
      { fingerprint: 10, file: makeContentFile() },
    ]);
    vi.mocked(getMods).mockResolvedValue([createProject()]);

    const answer = await launcherContentService.identifyFingerprints([10, 20]);

    expect(answer.matches.map((match) => match.fingerprint)).toEqual([10]);
    expect(answer.unmatchedFingerprints).toEqual([20]);
    expect(matchFingerprints).toHaveBeenCalledTimes(1);
    expect(getMods).toHaveBeenCalledTimes(1);
  });
});
