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
} from "@/services/curseforge";

const fetchMock = vi.fn<typeof fetch>();
const originalApiKey = config.curseforge.apiKey;

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
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

  it("keeps the files of the other batches when one batch is unknown as a whole", async () => {
    fetchMock
      .mockResolvedValueOnce(answer({}, 404))
      .mockResolvedValueOnce(answer({ data: [rawFile(7000001)] }));

    const details = await getFilesDetails([...idsOf(100, 990000000), 7000001]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(details.map((detail) => detail.fileId)).toEqual([7000001]);
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
