import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import os from "node:os";
import config from "@/config";
import {
  downloadModFile,
  getMod,
  getMods,
  getModpackFile,
} from "@/services/curseforge";
import {
  CURSEFORGE_CALL_COUNTS,
  curseforgeCallCounter,
  type CurseForgeCallCount,
} from "@/services/curseforge/call-counter";

const fetchMock = vi.fn<typeof fetch>();
const originalApiKey = config.curseforge.apiKey;

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

async function countedToday(): Promise<Record<CurseForgeCallCount, number>> {
  const { days } = await curseforgeCallCounter.read(CURSEFORGE_CALL_COUNTS, 1);
  return days[0]!.counts;
}

async function countedBy(
  act: () => Promise<unknown>,
): Promise<Record<CurseForgeCallCount, number>> {
  const before = await countedToday();
  await act().catch(() => undefined);
  const after = await countedToday();
  return {
    calls: after.calls - before.calls,
    refused: after.refused - before.refused,
    throttled: after.throttled - before.throttled,
  };
}

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

describe("counting calls to the CurseForge API", () => {
  it("counts an answered request as one call", async () => {
    fetchMock.mockResolvedValue(answer({ data: null }, 404));

    expect(await countedBy(() => getModpackFile(1, 2))).toEqual({
      calls: 1,
      refused: 0,
      throttled: 0,
    });
  });

  it("counts every batch of an id lookup", async () => {
    fetchMock.mockImplementation(async () => answer({ data: [] }));
    const ids = Array.from({ length: 150 }, (_, index) => index + 1);

    expect((await countedBy(() => getMods(ids))).calls).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("counts a request CurseForge refuses", async () => {
    fetchMock.mockResolvedValue(answer({}, 403));

    expect(await countedBy(() => getMod(328085))).toEqual({
      calls: 1,
      refused: 1,
      throttled: 0,
    });
  });

  it("counts a request CurseForge throttles", async () => {
    fetchMock.mockResolvedValue(answer({}, 429));

    expect(await countedBy(() => getMod(328085))).toEqual({
      calls: 1,
      refused: 0,
      throttled: 1,
    });
  });

  it("counts a request that got no answer", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(await countedBy(() => getMod(328085))).toEqual({
      calls: 1,
      refused: 0,
      throttled: 0,
    });
  });

  it("counts the lookup of a download address, not the download from the CDN", async () => {
    fetchMock
      .mockResolvedValueOnce(
        answer({ data: "https://edge.forgecdn.net/files/1/2/mod.jar" }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }));

    expect(
      (await countedBy(() => downloadModFile(1, 2, os.tmpdir(), "mod.jar")))
        .calls,
    ).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends the key with every request", async () => {
    fetchMock.mockResolvedValue(answer({ data: [] }));

    await getMods([1]);

    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.headers).toMatchObject({
      "x-api-key": "test-key",
      "Content-Type": "application/json",
    });
    expect(init?.method).toBe("POST");
  });
});
