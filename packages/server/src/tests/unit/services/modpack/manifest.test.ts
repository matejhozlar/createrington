import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { readModpackManifest, stored } = vi.hoisted(() => ({
  readModpackManifest: vi.fn(),
  stored: new Map<string, unknown>(),
}));

vi.mock("@/config", () => ({
  default: {
    curseforge: {
      modpackCacheTtlMs: 60_000,
      modpackIncompleteCacheTtlMs: 60_000,
    },
  },
}));
vi.mock("@/db", () => ({ Q: { modpack: { find: async () => null } } }));
vi.mock("@/services/key-value-store", () => ({
  createKeyValueStore: () => ({}),
  readStored: async (_store: unknown, key: string) => stored.get(key),
  writeStored: async (_store: unknown, key: string, value: unknown) => {
    stored.set(key, value);
  },
}));
vi.mock("@/services/curseforge/client", () => ({ MODPACK_PROJECT_ID: 1 }));
vi.mock("@/services/curseforge/modpack", () => ({
  fromStoredModpackManifest: (value: unknown) => value,
  toStoredModpackManifest: (value: unknown) => value,
}));
vi.mock("@/services/curseforge/modpack-manifest", () => ({
  readModpackManifest,
}));

import { getModpackManifest } from "@/services/modpack/manifest";

const T0 = new Date("2026-11-25T10:00:00Z");

function release(version: string) {
  return { manifest: { version }, complete: true };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  stored.clear();
  readModpackManifest.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getModpackManifest forced reads", () => {
  it("gives a second forced read inside ten seconds the first one's result, not the stored manifest", async () => {
    const pack = 101;
    readModpackManifest.mockResolvedValueOnce(release("1.0.0"));
    await getModpackManifest(pack);

    let finish: (value: unknown) => void = () => {};
    readModpackManifest.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const first = getModpackManifest(pack, { force: true });
    const second = getModpackManifest(pack, { force: true });
    await vi.advanceTimersByTimeAsync(0);
    finish(release("1.1.0"));

    expect(await first).toEqual({ version: "1.1.0" });
    expect(await second).toEqual({ version: "1.1.0" });
    expect(readModpackManifest).toHaveBeenCalledTimes(2);
  });

  it("reads again for a forced read more than ten seconds after the last", async () => {
    const pack = 102;
    readModpackManifest.mockResolvedValueOnce(release("1.0.0"));
    await getModpackManifest(pack, { force: true });

    vi.setSystemTime(new Date(T0.getTime() + 11_000));
    readModpackManifest.mockResolvedValueOnce(release("1.1.0"));

    expect(await getModpackManifest(pack, { force: true })).toEqual({
      version: "1.1.0",
    });
    expect(readModpackManifest).toHaveBeenCalledTimes(2);
  });

  it("serves an unforced read from the store", async () => {
    const pack = 103;
    readModpackManifest.mockResolvedValueOnce(release("1.0.0"));
    await getModpackManifest(pack);

    expect(await getModpackManifest(pack)).toEqual({ version: "1.0.0" });
    expect(readModpackManifest).toHaveBeenCalledTimes(1);
  });
});
