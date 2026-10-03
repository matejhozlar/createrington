import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const { packFiles } = vi.hoisted(() => ({
  packFiles: {
    publicUrl: null as string | null,
    internalUrl: null as string | null,
  },
}));

vi.mock("@/config", () => ({
  default: { launcher: { packFiles } },
}));

import { findSandboxFileUrls } from "@/services/launcher/pack/sandbox-files";

const PUBLIC = "https://sandbox.createrington.test/api/pack/files";
const INTERNAL = "http://127.0.0.1:8080/api/pack/files";

function jar(content: string, fileId: number) {
  const bytes = Buffer.from(content);
  return {
    bytes,
    query: {
      fileId,
      sha1: crypto.createHash("sha1").update(bytes).digest("hex"),
      size: bytes.length,
    },
  };
}

const KEPT = jar("the exact bytes of the published jar", 8328547);
const OTHER = jar("another published jar", 8584761);

function stubSandbox(files: Map<number, { status: number; body?: Buffer }>) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const answer = files.get(Number(url.split("/").pop())) ?? { status: 404 };
    const body = answer.body ?? Buffer.alloc(0);
    return new Response(answer.status === 200 ? new Uint8Array(body) : null, {
      status: answer.status,
      headers: { "content-length": String(body.length) },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  packFiles.publicUrl = PUBLIC;
  packFiles.internalUrl = INTERNAL;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findSandboxFileUrls", () => {
  it("fetches through the internal address and hands out the public one", async () => {
    const fetchMock = stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: KEPT.bytes }]]),
    );

    const urls = await findSandboxFileUrls([KEPT.query]);

    expect(fetchMock.mock.calls[0][0]).toBe(`${INTERNAL}/${KEPT.query.fileId}`);
    expect([...urls]).toEqual([
      [KEPT.query.fileId, `${PUBLIC}/${KEPT.query.fileId}`],
    ]);
  });

  it("answers per file: the kept one gets a link, the missing one does not", async () => {
    stubSandbox(
      new Map([[OTHER.query.fileId, { status: 200, body: OTHER.bytes }]]),
    );

    const urls = await findSandboxFileUrls([KEPT.query, OTHER.query]);

    expect([...urls.keys()]).toEqual([OTHER.query.fileId]);
  });

  it("refuses a copy whose bytes differ from the CurseForge file", async () => {
    const tampered = Buffer.from(KEPT.bytes);
    tampered[0] ^= 1;
    stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: tampered }]]),
    );

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
  });

  it("refuses a copy of another size", async () => {
    stubSandbox(
      new Map([
        [
          KEPT.query.fileId,
          { status: 200, body: Buffer.concat([KEPT.bytes, KEPT.bytes]) },
        ],
      ]),
    );

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
  });

  it("has no link when the sandbox answers with an error", async () => {
    stubSandbox(new Map([[KEPT.query.fileId, { status: 500 }]]));

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
  });

  it("has no link when the sandbox cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
  });

  it("asks every file at once instead of one after another", async () => {
    let open = 0;
    let mostOpen = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        open++;
        mostOpen = Math.max(mostOpen, open);
        await new Promise((resolve) => setTimeout(resolve, 20));
        open--;
        return new Response(null, { status: 404 });
      }),
    );

    await findSandboxFileUrls([KEPT.query, OTHER.query]);

    expect(mostOpen).toBe(2);
  });

  it("asks nothing while an address is missing", async () => {
    packFiles.internalUrl = null;
    const fetchMock = stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: KEPT.bytes }]]),
    );

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
