import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import config from "@/config";
import {
  getContentFiles,
  getMods,
  listCategories,
  listProjectFiles,
  matchFingerprints,
  searchProjects,
} from "@/services/curseforge";

const fetchMock = vi.fn<typeof fetch>();
const originalApiKey = config.curseforge.apiKey;

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function requestedUrl(call = 0): URL {
  return new URL(String(fetchMock.mock.calls[call]?.[0]));
}

const RAW_FILE = {
  id: 7000001,
  gameId: 432,
  modId: 439890,
  displayName: "Create Crafts & Additions 1.7.2",
  fileName: "createaddition-1.7.2.jar",
  fileDate: "2026-03-01T10:00:00.000Z",
  releaseType: 1,
  downloadUrl:
    "https://edge.forgecdn.net/files/7000/1/createaddition-1.7.2.jar",
  fileLength: 1234,
  hashes: [
    { value: "ABCDEF0123456789ABCDEF0123456789ABCDEF01", algo: 1 },
    { value: "0123456789abcdef0123456789abcdef", algo: 2 },
  ],
  gameVersions: ["Client", "1.21.1", "NeoForge", "Server"],
  dependencies: [
    { modId: 238222, relationType: 2 },
    { modId: 328085, relationType: 3 },
    { modId: 111111, relationType: 5 },
    { modId: 222222, relationType: 1 },
  ],
};

beforeAll(() => {
  (config.curseforge as { apiKey?: string }).apiKey = "test-key";
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  (config.curseforge as { apiKey?: string }).apiKey = originalApiKey;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("searchProjects", () => {
  const RAW_HIT = {
    id: 328085,
    name: "Create",
    slug: "create",
    summary: "Aesthetic Technology that empowers the Player",
    authors: [{ name: "simibubi" }, { name: "someone-else" }],
    downloadCount: 213407951,
    links: {
      websiteUrl: "https://www.curseforge.com/minecraft/mc-mods/create",
    },
    logo: { thumbnailUrl: "https://media.forgecdn.net/avatars/create.png" },
  };

  it("asks for one page of a class by popularity and reads the total", async () => {
    fetchMock.mockResolvedValue(
      answer({ data: [RAW_HIT], pagination: { totalCount: 2115 } }),
    );

    const found = await searchProjects({
      query: "create",
      classId: 6,
      gameVersion: "1.21.1",
      modLoaderType: 6,
      index: 40,
      pageSize: 20,
    });

    const url = requestedUrl();
    expect(url.pathname).toMatch(/\/v1\/mods\/search$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      gameId: "432",
      classId: "6",
      sortField: "2",
      sortOrder: "desc",
      index: "40",
      pageSize: "20",
      searchFilter: "create",
      gameVersion: "1.21.1",
      modLoaderType: "6",
    });
    expect(found).toEqual({
      projects: [
        {
          id: 328085,
          classId: 6,
          slug: "create",
          name: "Create",
          summary: "Aesthetic Technology that empowers the Player",
          websiteUrl: "https://www.curseforge.com/minecraft/mc-mods/create",
          thumbnailUrl: "https://media.forgecdn.net/avatars/create.png",
          primaryAuthor: "simibubi",
          downloadCount: 213407951,
        },
      ],
      total: 2115,
    });
  });

  it("leaves text, game version and loader out when they are not given", async () => {
    fetchMock.mockResolvedValue(
      answer({ data: [], pagination: { totalCount: 0 } }),
    );

    await searchProjects({
      query: "",
      classId: 6552,
      modLoaderType: null,
      index: 0,
      pageSize: 20,
    });

    const params = requestedUrl().searchParams;
    expect(params.has("searchFilter")).toBe(false);
    expect(params.has("gameVersion")).toBe(false);
    expect(params.has("modLoaderType")).toBe(false);
    expect(params.get("classId")).toBe("6552");
  });

  it("narrows the search to categories and sorts by the field it is given", async () => {
    fetchMock.mockResolvedValue(
      answer({ data: [], pagination: { totalCount: 0 } }),
    );

    await searchProjects({
      query: "",
      classId: 6,
      gameVersion: "1.21.1",
      modLoaderType: 6,
      categoryIds: [412, 420],
      sortField: 11,
      index: 0,
      pageSize: 20,
    });

    expect(Object.fromEntries(requestedUrl().searchParams)).toEqual({
      gameId: "432",
      classId: "6",
      sortField: "11",
      sortOrder: "desc",
      index: "0",
      pageSize: "20",
      categoryIds: "[412,420]",
      gameVersion: "1.21.1",
      modLoaderType: "6",
    });
  });

  it("names no categories when the list is empty", async () => {
    fetchMock.mockResolvedValue(
      answer({ data: [], pagination: { totalCount: 0 } }),
    );

    await searchProjects({
      query: "create",
      classId: 6,
      categoryIds: [],
      index: 0,
      pageSize: 20,
    });

    const params = requestedUrl().searchParams;
    expect(params.has("categoryIds")).toBe(false);
    expect(params.get("sortField")).toBe("2");
  });

  it("reads a hit without summary, author, picture or download count", async () => {
    fetchMock.mockResolvedValue(
      answer({
        data: [
          {
            id: 1,
            name: "Bare",
            slug: "bare",
            links: { websiteUrl: "" },
          },
        ],
        pagination: { totalCount: 1 },
      }),
    );

    const found = await searchProjects({
      query: "bare",
      classId: 6,
      index: 0,
      pageSize: 20,
    });

    expect(found.projects[0]).toMatchObject({
      summary: null,
      thumbnailUrl: null,
      primaryAuthor: null,
      downloadCount: 0,
    });
  });

  it("throws when CurseForge refuses the search", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));

    await expect(
      searchProjects({ query: "x", classId: 6, index: 0, pageSize: 20 }),
    ).rejects.toThrow("CurseForge search failed (500)");
  });
});

describe("listCategories", () => {
  it("asks for the categories of a Minecraft class and reads each with its parent", async () => {
    fetchMock.mockResolvedValue(
      answer({
        data: [
          {
            id: 412,
            gameId: 432,
            name: "Technology",
            slug: "technology",
            url: "https://www.curseforge.com/minecraft/mc-mods/technology",
            iconUrl: "https://media.forgecdn.net/avatars/technology.png",
            isClass: false,
            classId: 6,
            parentCategoryId: 6,
          },
          {
            id: 417,
            name: "Energy",
            slug: "technology-energy",
            iconUrl: "",
            classId: 6,
            parentCategoryId: 412,
          },
          { id: 6, name: "Mods", slug: "mc-mods", isClass: true },
        ],
      }),
    );

    const categories = await listCategories(6);

    const url = requestedUrl();
    expect(url.pathname).toMatch(/\/v1\/categories$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      gameId: "432",
      classId: "6",
    });
    expect(categories).toEqual([
      {
        id: 412,
        name: "Technology",
        slug: "technology",
        iconUrl: "https://media.forgecdn.net/avatars/technology.png",
        parentCategoryId: 6,
      },
      {
        id: 417,
        name: "Energy",
        slug: "technology-energy",
        iconUrl: null,
        parentCategoryId: 412,
      },
    ]);
  });

  it("throws when CurseForge refuses", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));

    await expect(listCategories(6)).rejects.toThrow(
      "CurseForge categories failed (500)",
    );
  });
});

describe("listProjectFiles", () => {
  it("asks for one page of a project's files and reads the total", async () => {
    fetchMock.mockResolvedValue(
      answer({ data: [RAW_FILE], pagination: { totalCount: 11 } }),
    );

    const listed = await listProjectFiles(439890, {
      gameVersion: "1.21.1",
      modLoaderType: 6,
      index: 20,
      pageSize: 10,
    });

    const url = requestedUrl();
    expect(url.pathname).toMatch(/\/v1\/mods\/439890\/files$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      index: "20",
      pageSize: "10",
      gameVersion: "1.21.1",
      modLoaderType: "6",
    });
    expect(listed.total).toBe(11);
    expect(listed.files).toEqual([
      {
        id: 7000001,
        projectId: 439890,
        gameId: 432,
        displayName: "Create Crafts & Additions 1.7.2",
        fileName: "createaddition-1.7.2.jar",
        fileDate: "2026-03-01T10:00:00.000Z",
        releaseType: 1,
        downloadUrl:
          "https://edge.forgecdn.net/files/7000/1/createaddition-1.7.2.jar",
        fileLength: 1234,
        sha1: "abcdef0123456789abcdef0123456789abcdef01",
        gameVersions: ["Client", "1.21.1", "NeoForge", "Server"],
        dependencies: [
          { projectId: 238222, required: false },
          { projectId: 328085, required: true },
        ],
      },
    ]);
  });

  it("reads a file CurseForge gives no download link for", async () => {
    fetchMock.mockResolvedValue(
      answer({
        data: [{ ...RAW_FILE, downloadUrl: null }],
        pagination: { totalCount: 1 },
      }),
    );

    const listed = await listProjectFiles(439890, { index: 0, pageSize: 10 });

    expect(listed.files[0]?.downloadUrl).toBeNull();
  });
});

describe("getContentFiles", () => {
  it("asks for nothing without ids", async () => {
    expect(await getContentFiles([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the files CurseForge knows", async () => {
    fetchMock.mockResolvedValue(answer({ data: [RAW_FILE] }));

    const files = await getContentFiles([7000001, 999999999]);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      fileIds: [7000001, 999999999],
    });
    expect(files.map((file) => file.id)).toEqual([7000001]);
  });

  it("finds nothing when CurseForge knows none of the ids", async () => {
    fetchMock.mockResolvedValue(answer({}, 404));

    expect(await getContentFiles([999999999])).toEqual([]);
  });

  it("throws when CurseForge fails", async () => {
    fetchMock.mockResolvedValue(answer({}, 503));

    await expect(getContentFiles([7000001])).rejects.toThrow(
      "CurseForge getContentFiles failed (503)",
    );
  });
});

describe("matchFingerprints", () => {
  function matches(files: unknown[]) {
    return {
      data: {
        isCacheBuilt: true,
        exactMatches: files.map((file) => ({
          id: 439890,
          file,
          latestFiles: [],
        })),
        exactFingerprints: [],
        partialMatches: [],
        partialMatchFingerprints: {},
        installedFingerprints: [],
        unmatchedFingerprints: null,
      },
    };
  }

  it("asks Minecraft for the fingerprints in one request and reads the files", async () => {
    fetchMock.mockResolvedValue(
      answer(matches([{ ...RAW_FILE, fileFingerprint: 522093599 }])),
    );

    const found = await matchFingerprints([522093599, 1]);

    expect(requestedUrl().pathname).toMatch(/\/v1\/fingerprints\/432$/);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      fingerprints: [522093599, 1],
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      fingerprint: 522093599,
      file: {
        id: 7000001,
        projectId: 439890,
        sha1: "abcdef0123456789abcdef0123456789abcdef01",
        dependencies: [
          { projectId: 238222, required: false },
          { projectId: 328085, required: true },
        ],
      },
    });
  });

  it("finds nothing when CurseForge knows none of the fingerprints", async () => {
    fetchMock.mockResolvedValue(answer(matches([])));

    expect(await matchFingerprints([1, 2])).toEqual([]);
  });

  it("answers every file that shares a fingerprint, in CurseForge's order", async () => {
    fetchMock.mockResolvedValue(
      answer(
        matches([
          { ...RAW_FILE, fileFingerprint: 7 },
          { ...RAW_FILE, id: 7000002, modId: 238222, fileFingerprint: 7 },
        ]),
      ),
    );

    const found = await matchFingerprints([7]);

    expect(found.map((match) => [match.fingerprint, match.file.id])).toEqual([
      [7, 7000001],
      [7, 7000002],
    ]);
  });

  it("throws when CurseForge fails", async () => {
    fetchMock.mockResolvedValue(answer({}, 503));

    await expect(matchFingerprints([1])).rejects.toThrow(
      "CurseForge matchFingerprints failed (503)",
    );
  });
});

describe("getMods", () => {
  it("finds nothing when CurseForge knows none of the ids", async () => {
    fetchMock.mockResolvedValue(answer({}, 404));

    expect(await getMods([999999999])).toEqual([]);
  });

  it("still throws when CurseForge fails", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));

    await expect(getMods([328085])).rejects.toThrow(
      "CurseForge getMods failed (500)",
    );
  });
});
