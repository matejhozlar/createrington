import { describe, it, expect, afterEach, vi } from "vitest";
import { findCurseforgeCdnUrls } from "@/services/launcher/pack/curseforge-cdn";

const BLOCKED = {
  fileId: 8584761,
  fileName: "create-collision-fix-1.0.1.jar",
  size: 4443,
};
const BLOCKED_URL =
  "https://mediafilez.forgecdn.net/files/8584/761/create-collision-fix-1.0.1.jar";
const OTHER = {
  fileId: 8664066,
  fileName: "Other Mod (NeoForge).jar",
  size: 9,
};
const OTHER_URL =
  "https://mediafilez.forgecdn.net/files/8664/66/Other%20Mod%20%28NeoForge%29.jar";

function stubCdn(
  answers: Map<string, { status: number; contentLength?: number }>,
) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const answer = answers.get(url) ?? { status: 403 };
    return new Response(null, {
      status: answer.status,
      headers:
        answer.contentLength === undefined
          ? {}
          : { "content-length": String(answer.contentLength) },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findCurseforgeCdnUrls", () => {
  it("hands out the built address when it answers with CurseForge's size", async () => {
    const fetchMock = stubCdn(
      new Map([[BLOCKED_URL, { status: 200, contentLength: BLOCKED.size }]]),
    );

    const urls = await findCurseforgeCdnUrls([BLOCKED]);

    expect([...urls]).toEqual([[BLOCKED.fileId, BLOCKED_URL]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("HEAD");
  });

  it("answers per file: the one the CDN has gets a link, the other does not", async () => {
    stubCdn(new Map([[OTHER_URL, { status: 200, contentLength: OTHER.size }]]));

    const urls = await findCurseforgeCdnUrls([BLOCKED, OTHER]);

    expect([...urls]).toEqual([[OTHER.fileId, OTHER_URL]]);
  });

  it("refuses an address that answers with another size", async () => {
    stubCdn(
      new Map([
        [BLOCKED_URL, { status: 200, contentLength: BLOCKED.size + 1 }],
      ]),
    );

    expect((await findCurseforgeCdnUrls([BLOCKED])).size).toBe(0);
  });

  it("refuses an address that answers without a size", async () => {
    stubCdn(new Map([[BLOCKED_URL, { status: 200 }]]));

    expect((await findCurseforgeCdnUrls([BLOCKED])).size).toBe(0);
  });

  it.each([403, 404, 500])(
    "has no link when the CDN answers %i",
    async (status) => {
      stubCdn(new Map([[BLOCKED_URL, { status }]]));

      expect((await findCurseforgeCdnUrls([BLOCKED])).size).toBe(0);
    },
  );

  it("has no link when the CDN cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    expect((await findCurseforgeCdnUrls([BLOCKED])).size).toBe(0);
  });

  it("asks nothing for an empty list", async () => {
    const fetchMock = stubCdn(new Map());

    expect((await findCurseforgeCdnUrls([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
