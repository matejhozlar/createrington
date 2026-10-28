import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const { packFiles, links } = vi.hoisted(() => ({
  packFiles: {
    internalUrl: null as string | null,
  },
  links: {
    website: undefined as string | undefined,
  },
}));

vi.mock("@/config", () => ({
  default: { launcher: { packFiles }, meta: { links } },
}));

import {
  findSandboxFileUrls,
  findSandboxSnapshotUrl,
  openSandboxFile,
  SandboxUnavailableError,
  storageFileUrl,
  storageSnapshotUrl,
} from "@/services/launcher/pack/sandbox-files";

const WEBSITE = "https://dev.createrington.test";
const INTERNAL = "http://127.0.0.1:8080/api/pack/files";
const STORAGE = `${WEBSITE}/api/launcher/packs/files`;

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

function stubSandbox(
  files: Map<number | string, { status: number; body?: Buffer }>,
) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const path = url.slice(INTERNAL.length + 1);
    const answer: { status: number; body?: Buffer } = files.get(path) ??
      files.get(Number(path)) ?? { status: 404 };
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
  packFiles.internalUrl = INTERNAL;
  links.website = WEBSITE;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage links", () => {
  it("point at the app's own download routes on the website address", () => {
    expect(storageFileUrl(8328547)).toBe(`${STORAGE}/8328547`);
    expect(storageSnapshotUrl(7)).toBe(`${STORAGE}/snapshot/7`);
  });

  it("drop a trailing slash of the website address", () => {
    links.website = `${WEBSITE}/`;

    expect(storageFileUrl(1)).toBe(`${STORAGE}/1`);
  });

  it("fall back to the public website while none is configured", () => {
    links.website = undefined;

    expect(storageFileUrl(1)).toBe(
      "https://createrington.com/api/launcher/packs/files/1",
    );
  });
});

describe("findSandboxFileUrls", () => {
  it("fetches through the internal address and hands out the app's link", async () => {
    const fetchMock = stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: KEPT.bytes }]]),
    );

    const urls = await findSandboxFileUrls([KEPT.query]);

    expect(fetchMock.mock.calls[0][0]).toBe(`${INTERNAL}/${KEPT.query.fileId}`);
    expect([...urls]).toEqual([
      [KEPT.query.fileId, `${STORAGE}/${KEPT.query.fileId}`],
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

  it("asks nothing while the internal address is missing", async () => {
    packFiles.internalUrl = null;
    const fetchMock = stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: KEPT.bytes }]]),
    );

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hashes a copy the sandbox streams in pieces", async () => {
    const half = Math.floor(KEPT.bytes.length / 2);
    const pieces = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(KEPT.bytes.subarray(0, half)));
        controller.enqueue(new Uint8Array(KEPT.bytes.subarray(half)));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(pieces, { status: 200 })),
    );

    expect([...(await findSandboxFileUrls([KEPT.query]))]).toEqual([
      [KEPT.query.fileId, `${STORAGE}/${KEPT.query.fileId}`],
    ]);
  });

  it("stops reading a copy that runs past the expected size instead of buffering it", async () => {
    let pulls = 0;
    let cancelled = false;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(KEPT.bytes));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(endless, { status: 200 })),
    );

    expect((await findSandboxFileUrls([KEPT.query])).size).toBe(0);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(4);
  });
});

describe("findSandboxSnapshotUrl", () => {
  const ZIP = jar("the snapshot zip", 7);
  const query = { snapshotId: 7, sha1: ZIP.query.sha1, size: ZIP.query.size };

  it("reads the zip through the internal address and hands out the app's link", async () => {
    const fetchMock = stubSandbox(
      new Map([["snapshot/7", { status: 200, body: ZIP.bytes }]]),
    );

    const url = await findSandboxSnapshotUrl(query);

    expect(fetchMock.mock.calls[0][0]).toBe(`${INTERNAL}/snapshot/7`);
    expect(url).toBe(`${STORAGE}/snapshot/7`);
  });

  it("has no link for a zip the sandbox does not keep", async () => {
    stubSandbox(new Map());

    expect(await findSandboxSnapshotUrl(query)).toBeNull();
  });

  it("has no link for a zip of other bytes", async () => {
    stubSandbox(
      new Map([["snapshot/7", { status: 200, body: Buffer.from("other") }]]),
    );

    expect(await findSandboxSnapshotUrl(query)).toBeNull();
  });
});

describe("openSandboxFile", () => {
  it("hands out the body the sandbox streams, without buffering it", async () => {
    const fetchMock = stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: KEPT.bytes }]]),
    );

    const download = await openSandboxFile(
      String(KEPT.query.fileId),
      KEPT.query.size,
      new AbortController().signal,
    );

    expect(fetchMock.mock.calls[0][0]).toBe(`${INTERNAL}/${KEPT.query.fileId}`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
    expect(download?.size).toBe(KEPT.query.size);
    expect(
      Buffer.from(await new Response(download?.body).arrayBuffer()),
    ).toEqual(KEPT.bytes);
  });

  it("is null for a file the sandbox does not keep", async () => {
    stubSandbox(new Map());

    expect(
      await openSandboxFile("1", 10, new AbortController().signal),
    ).toBeNull();
  });

  it("refuses a file the sandbox declares with another size", async () => {
    stubSandbox(
      new Map([[KEPT.query.fileId, { status: 200, body: KEPT.bytes }]]),
    );

    await expect(
      openSandboxFile(
        String(KEPT.query.fileId),
        KEPT.query.size + 1,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(SandboxUnavailableError);
  });

  it("fails when the sandbox answers with an error", async () => {
    stubSandbox(new Map([[KEPT.query.fileId, { status: 500 }]]));

    await expect(
      openSandboxFile(
        String(KEPT.query.fileId),
        KEPT.query.size,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(SandboxUnavailableError);
  });

  it("fails when the sandbox redirects instead of serving", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://example.com/elsewhere" },
          }),
      ),
    );

    await expect(
      openSandboxFile("1", 10, new AbortController().signal),
    ).rejects.toBeInstanceOf(SandboxUnavailableError);
  });

  it("fails when the sandbox cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(
      openSandboxFile("1", 10, new AbortController().signal),
    ).rejects.toBeInstanceOf(SandboxUnavailableError);
  });

  it("fails while the internal address is missing, without asking", async () => {
    packFiles.internalUrl = null;
    const fetchMock = stubSandbox(new Map());

    await expect(
      openSandboxFile("1", 10, new AbortController().signal),
    ).rejects.toBeInstanceOf(SandboxUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancels the download when the caller aborts", async () => {
    let seen: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seen = init?.signal ?? undefined;
        return new Response(new Uint8Array(KEPT.bytes), {
          status: 200,
          headers: { "content-length": String(KEPT.bytes.length) },
        });
      }),
    );
    const caller = new AbortController();

    await openSandboxFile(
      String(KEPT.query.fileId),
      KEPT.query.size,
      caller.signal,
    );
    caller.abort();

    expect(seen?.aborted).toBe(true);
  });
});

describe("openSandboxFile progress", () => {
  function sandboxThatSends(size = 1000) {
    let upstream: AbortSignal | undefined;
    let push!: (chunk: Uint8Array) => void;
    let end!: () => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        upstream = init?.signal ?? undefined;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            push = (chunk) => controller.enqueue(chunk);
            end = () => controller.close();
            upstream?.addEventListener("abort", () =>
              controller.error(upstream?.reason),
            );
          },
        });
        return new Response(body, {
          status: 200,
          headers: { "content-length": String(size) },
        });
      }),
    );
    return {
      upstream: () => upstream,
      push: (chunk: Uint8Array) => push(chunk),
      end: () => end(),
    };
  }

  async function openWatched(size = 1000) {
    const download = await openSandboxFile(
      "1",
      size,
      new AbortController().signal,
    );
    return download!.body.getReader();
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("drops the sandbox connection when no bytes arrive for thirty seconds", async () => {
    const sandbox = sandboxThatSends();
    const reader = await openWatched();
    sandbox.push(new Uint8Array(10));
    await reader.read();

    await vi.advanceTimersByTimeAsync(29_000);
    expect(sandbox.upstream()?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sandbox.upstream()?.aborted).toBe(true);
    await expect(reader.read()).rejects.toThrow(
      "no bytes arrived for 30 seconds",
    );
  });

  it("keeps a download going while bytes keep arriving", async () => {
    const sandbox = sandboxThatSends();
    const reader = await openWatched();

    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      sandbox.push(new Uint8Array(10));
      await reader.read();
    }

    expect(sandbox.upstream()?.aborted).toBe(false);
  });

  it("drops a download that trickles on for thirty minutes", async () => {
    const sandbox = sandboxThatSends();
    const reader = await openWatched();

    for (let i = 0; i < 179; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sandbox.push(new Uint8Array(1));
      await reader.read();
    }
    expect(sandbox.upstream()?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(sandbox.upstream()?.aborted).toBe(true);
    await expect(reader.read()).rejects.toThrow(
      "the download did not finish within 30 minutes",
    );
  });

  it("gives a large file the time it needs at 32 KiB per second", async () => {
    const size = 100 * 1024 * 1024;
    const sandbox = sandboxThatSends(size);
    const reader = await openWatched(size);

    for (let i = 0; i < 319; i++) {
      await vi.advanceTimersByTimeAsync(10_000);
      sandbox.push(new Uint8Array(1));
      await reader.read();
    }
    expect(sandbox.upstream()?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(sandbox.upstream()?.aborted).toBe(true);
    await expect(reader.read()).rejects.toThrow(
      "the download did not finish within 53 minutes",
    );
  });

  it("stops watching once the sandbox sent the whole file", async () => {
    const sandbox = sandboxThatSends();
    const reader = await openWatched();
    sandbox.push(new Uint8Array(1000));
    sandbox.end();
    await reader.read();
    expect((await reader.read()).done).toBe(true);
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
    expect(sandbox.upstream()?.aborted).toBe(false);
  });

  it("stops watching once the caller gives up on the body", async () => {
    const sandbox = sandboxThatSends();
    const reader = await openWatched();
    await reader.cancel();
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("openSandboxFile without a declared size", () => {
  it("refuses a file the sandbox streams without saying how long it is", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(KEPT.bytes), {
            status: 200,
            headers: { "transfer-encoding": "chunked" },
          }),
      ),
    );

    await expect(
      openSandboxFile(
        String(KEPT.query.fileId),
        KEPT.query.size,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(SandboxUnavailableError);
  });
});
