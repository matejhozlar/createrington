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
    listProjectFiles: vi.fn(),
    getContentFiles: vi.fn(),
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
  getMods,
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
    thumbnailUrl: null,
    authors: [{ id: 1, name: "vitest", url: "https://example.com" }],
    categories: [],
    screenshots: [],
    downloadCount: 0,
    isAvailable: true,
    allowModDistribution: true,
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
