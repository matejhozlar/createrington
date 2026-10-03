import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("@/config", () => ({
  default: { meta: { links: { website: "https://createrington.test" } } },
}));

import { findModrinthFilesBySha1 } from "@/services/modrinth";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const SHA_OTHER = "c".repeat(40);

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function version(
  files: Array<{ sha1: string; url: string; filename?: string }>,
) {
  return {
    files: files.map((file) => ({
      hashes: { sha1: file.sha1, sha512: "unused" },
      url: file.url,
      filename: file.filename ?? "mod.jar",
      size: 1234,
      primary: true,
    })),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findModrinthFilesBySha1", () => {
  it("asks for all hashes in one sha1 lookup and returns the matching file", async () => {
    const url = "https://cdn.modrinth.com/data/abc/versions/def/mod-1.0.jar";
    const fetchMock = stubFetch(200, {
      [SHA_A]: version([{ sha1: SHA_A, url, filename: "mod-1.0.jar" }]),
    });

    const found = await findModrinthFilesBySha1([SHA_A.toUpperCase(), SHA_B]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetchMock.mock.calls[0];
    expect(requestUrl).toBe("https://api.modrinth.com/v2/version_files");
    expect(JSON.parse(String(init?.body))).toEqual({
      hashes: [SHA_A, SHA_B],
      algorithm: "sha1",
    });
    expect([...found]).toEqual([
      [SHA_A, { sha1: SHA_A, url, fileName: "mod-1.0.jar", size: 1234 }],
    ]);
  });

  it("never returns another file of the same version", async () => {
    stubFetch(200, {
      [SHA_A]: version([
        {
          sha1: SHA_OTHER,
          url: "https://cdn.modrinth.com/data/abc/versions/def/sources.jar",
        },
      ]),
    });

    expect((await findModrinthFilesBySha1([SHA_A])).size).toBe(0);
  });

  it("ignores a file that is not served from the Modrinth CDN", async () => {
    stubFetch(200, {
      [SHA_A]: version([{ sha1: SHA_A, url: "https://example.com/mod.jar" }]),
    });

    expect((await findModrinthFilesBySha1([SHA_A])).size).toBe(0);
  });

  it("makes no request without hashes", async () => {
    const fetchMock = stubFetch(200, {});

    expect((await findModrinthFilesBySha1([])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when Modrinth does not answer", async () => {
    stubFetch(503, {});

    await expect(findModrinthFilesBySha1([SHA_A])).rejects.toThrow(/503/);
  });
});
