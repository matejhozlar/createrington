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
  getFilesDependencies,
  getFilesDetails,
  getServedFileIds,
  resolveDependencies,
} from "@/services/curseforge";
import { requestedUrl, sentJson } from "@/tests/helpers/fetch";

const fetchMock = vi.fn<typeof fetch>();

const GATEWAY = { url: "http://gateway.test:5005", token: "t".repeat(32) };
const originalGateway = config.contentGateway;

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-cache": "miss" },
  });
}

function rawFile(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    gameId: 432,
    modId: 328085,
    displayName: `File ${id}`,
    fileName: `file-${id}.jar`,
    fileDate: "2026-03-01T10:00:00.000Z",
    releaseType: 1,
    downloadUrl: `https://edge.forgecdn.net/files/${id}/file-${id}.jar`,
    fileLength: 1234,
    hashes: [{ value: "ABCDEF0123456789ABCDEF0123456789ABCDEF01", algo: 1 }],
    isAvailable: true,
    dependencies: [
      { modId: 238222, relationType: 2 },
      { modId: 111111, relationType: 5 },
    ],
    ...overrides,
  };
}

const idsOf = (count: number, from: number) =>
  Array.from({ length: count }, (_, index) => from + index);

type GatewayConfig = { contentGateway: typeof config.contentGateway };

beforeAll(() => {
  (config as GatewayConfig).contentGateway = GATEWAY;
  vi.stubGlobal("fetch", fetchMock);
});

afterAll(() => {
  (config as GatewayConfig).contentGateway = originalGateway;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("getFilesDetails", () => {
  it("reads the files CurseForge knows and leaves the others out", async () => {
    fetchMock.mockResolvedValue(answer({ data: [rawFile(7000001)] }));

    const details = await getFilesDetails([7000001, 999999999]);

    expect(details).toEqual([
      {
        fileId: 7000001,
        projectId: 328085,
        displayName: "File 7000001",
        fileName: "file-7000001.jar",
        fileDate: "2026-03-01T10:00:00.000Z",
        releaseType: 1,
        gameId: 432,
        downloadUrl: "https://edge.forgecdn.net/files/7000001/file-7000001.jar",
        fileLength: 1234,
        sha1: "abcdef0123456789abcdef0123456789abcdef01",
      },
    ]);
  });

  it("finds nothing when CurseForge knows none of the ids", async () => {
    fetchMock.mockResolvedValue(answer({}, 404));

    expect(await getFilesDetails([999999999])).toEqual([]);
  });

  it("asks for every id in one request, whatever their number", async () => {
    fetchMock.mockResolvedValue(answer({ data: [rawFile(7000001)] }));
    const ids = [...idsOf(150, 990000000), 7000001];

    const details = await getFilesDetails(ids);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentJson(fetchMock)).toEqual({
      fileIds: ids,
    });
    expect(details.map((detail) => detail.fileId)).toEqual([7000001]);
  });

  it("asks for nothing without ids", async () => {
    expect(await getFilesDetails([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still throws when CurseForge fails", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));

    await expect(getFilesDetails([7000001])).rejects.toThrow(
      "Failed to fetch file details (500)",
    );
  });
});

describe("getServedFileIds", () => {
  it("leaves out archived files and files CurseForge does not know", async () => {
    fetchMock.mockResolvedValue(
      answer({
        data: [rawFile(7000001), rawFile(7000002, { isAvailable: false })],
      }),
    );

    const served = await getServedFileIds([7000001, 7000002, 999999999]);

    expect([...served]).toEqual([7000001]);
  });

  it("serves nothing when CurseForge knows none of the ids", async () => {
    fetchMock.mockResolvedValue(answer({}, 404));

    expect((await getServedFileIds([999999999])).size).toBe(0);
  });
});

describe("getFilesDependencies", () => {
  it("reads the optional and required dependencies of the files CurseForge knows", async () => {
    fetchMock.mockResolvedValue(answer({ data: [rawFile(7000001)] }));

    expect(await getFilesDependencies([7000001, 999999999])).toEqual([
      {
        fileId: 7000001,
        modId: 328085,
        dependencies: [{ modId: 238222, relationType: 2 }],
      },
    ]);
  });

  it("finds nothing when CurseForge knows none of the ids", async () => {
    fetchMock.mockResolvedValue(answer({}, 404));

    expect(await getFilesDependencies([999999999])).toEqual([]);
  });

  it("still throws when CurseForge fails", async () => {
    fetchMock.mockResolvedValue(answer({}, 503));

    await expect(getFilesDependencies([7000001])).rejects.toThrow(
      "Failed to fetch file dependencies (503)",
    );
  });
});

describe("resolveDependencies", () => {
  function rawMod(id: number) {
    return {
      id,
      name: `Mod ${id}`,
      links: {
        websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/mod-${id}`,
      },
      logo: { thumbnailUrl: `https://media.forgecdn.net/avatars/${id}.png` },
      latestFilesIndexes: [
        {
          gameVersion: "1.21.1",
          fileId: id + 1,
          filename: `mod-${id}.jar`,
          releaseType: 1,
          modLoader: 6,
        },
      ],
    };
  }

  const TARGET = { gameVersion: "1.21.1", modLoaderType: 6 };

  it("asks for the projects by id and resolves the ones CurseForge knows", async () => {
    fetchMock.mockResolvedValue(answer({ data: [rawMod(238222)] }));

    const resolved = await resolveDependencies(
      [238222, 999999999],
      new Set([238222]),
      TARGET,
    );

    expect(requestedUrl(fetchMock).pathname).toBe("/v1/curseforge/mods");
    expect(sentJson(fetchMock)).toEqual({
      modIds: [238222, 999999999],
    });
    expect(resolved).toEqual([
      {
        modId: 238222,
        modName: "Mod 238222",
        modUrl: "https://www.curseforge.com/minecraft/mc-mods/mod-238222",
        thumbnailUrl: "https://media.forgecdn.net/avatars/238222.png",
        inPack: true,
        bestFile: { id: 238223, fileName: "mod-238222.jar" },
      },
    ]);
  });

  it("resolves nothing when CurseForge knows none of the ids", async () => {
    fetchMock.mockResolvedValue(answer({}, 404));

    expect(await resolveDependencies([999999999], new Set(), TARGET)).toEqual(
      [],
    );
  });

  it("still throws when CurseForge fails", async () => {
    fetchMock.mockResolvedValue(answer({}, 500));

    await expect(
      resolveDependencies([238222], new Set(), TARGET),
    ).rejects.toThrow("Failed to resolve dependencies (500)");
  });
});
