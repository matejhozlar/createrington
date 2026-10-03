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

import { findSandboxFileUrl } from "@/services/launcher/pack/sandbox-files";

const PUBLIC = "https://sandbox.createrington.test/api/pack/files";
const INTERNAL = "http://127.0.0.1:8080/api/pack/files";
const JAR = Buffer.from("the exact bytes of the published jar");
const FILE = {
  fileId: 8328547,
  sha1: crypto.createHash("sha1").update(JAR).digest("hex"),
  size: JAR.length,
};

function stubFetch(status: number, body: Buffer = Buffer.alloc(0)) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(status === 200 ? new Uint8Array(body) : null, {
        status,
        headers: { "content-length": String(body.length) },
      }),
  );
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

describe("findSandboxFileUrl", () => {
  it("fetches the file through the internal address and hands out the public one", async () => {
    const fetchMock = stubFetch(200, JAR);

    const url = await findSandboxFileUrl(FILE);

    expect(fetchMock.mock.calls[0][0]).toBe(`${INTERNAL}/${FILE.fileId}`);
    expect(url).toBe(`${PUBLIC}/${FILE.fileId}`);
  });

  it("refuses a copy whose bytes differ from the CurseForge file", async () => {
    const tampered = Buffer.from(JAR);
    tampered[0] ^= 1;
    stubFetch(200, tampered);

    expect(await findSandboxFileUrl(FILE)).toBeNull();
  });

  it("refuses a copy of another size without hashing it", async () => {
    stubFetch(200, Buffer.concat([JAR, JAR]));

    expect(await findSandboxFileUrl(FILE)).toBeNull();
  });

  it.each([404, 500])(
    "has no link when the sandbox answers %i",
    async (status) => {
      stubFetch(status);

      expect(await findSandboxFileUrl(FILE)).toBeNull();
    },
  );

  it("has no link when the sandbox cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    expect(await findSandboxFileUrl(FILE)).toBeNull();
  });

  it("asks nothing while no address is configured", async () => {
    packFiles.publicUrl = null;
    packFiles.internalUrl = null;
    const fetchMock = stubFetch(200, JAR);

    expect(await findSandboxFileUrl(FILE)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
