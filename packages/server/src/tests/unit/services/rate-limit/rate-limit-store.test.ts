import { describe, it, expect, afterEach, vi } from "vitest";
import type { Options, Store } from "express-rate-limit";
import { FallbackRateLimitStore } from "@/services/rate-limit";

const OPTIONS = { windowMs: 60_000 } as Options;

function fakeRemote() {
  const hits = new Map<string, number>();
  const resetTime = new Date(Date.now() + OPTIONS.windowMs);
  return {
    hits,
    init: vi.fn(async (_options: Options) => {}),
    get: vi.fn(async (key: string) => {
      const totalHits = hits.get(key);
      return totalHits === undefined ? undefined : { totalHits, resetTime };
    }),
    increment: vi.fn(async (key: string) => {
      const totalHits = (hits.get(key) ?? 0) + 1;
      hits.set(key, totalHits);
      return { totalHits, resetTime };
    }),
    decrement: vi.fn(async (key: string) => {
      hits.set(key, (hits.get(key) ?? 1) - 1);
    }),
    resetKey: vi.fn(async (key: string) => {
      hits.delete(key);
    }),
  } satisfies Store & { hits: Map<string, number> };
}

const opened: FallbackRateLimitStore[] = [];

function openStore(isRemoteUp: () => boolean, createRemote: () => Store) {
  const store = new FallbackRateLimitStore("test:", isRemoteUp, createRemote);
  store.init(OPTIONS);
  opened.push(store);
  return store;
}

afterEach(() => {
  for (const store of opened.splice(0)) store.shutdown();
});

describe("FallbackRateLimitStore", () => {
  it("counts in the remote store while it is up", async () => {
    const remote = fakeRemote();
    const createRemote = vi.fn(() => remote);
    const store = openStore(() => true, createRemote);

    expect((await store.increment("player")).totalHits).toBe(1);
    expect((await store.increment("player")).totalHits).toBe(2);

    expect(remote.hits.get("player")).toBe(2);
    expect(createRemote).toHaveBeenCalledTimes(1);
    expect(remote.init).toHaveBeenCalledWith(OPTIONS);
  });

  it("counts in memory while the remote store is down", async () => {
    const createRemote = vi.fn(() => fakeRemote());
    const store = openStore(() => false, createRemote);

    expect((await store.increment("player")).totalHits).toBe(1);
    expect((await store.increment("player")).totalHits).toBe(2);
    expect((await store.get("player"))?.totalHits).toBe(2);

    expect(createRemote).not.toHaveBeenCalled();
  });

  it("counts a hit in memory when the remote store fails", async () => {
    const remote = fakeRemote();
    remote.increment.mockRejectedValue(new Error("remote down"));
    const store = openStore(
      () => true,
      () => remote,
    );

    expect((await store.increment("player")).totalHits).toBe(1);
    expect((await store.increment("player")).totalHits).toBe(2);
  });

  it("counts in memory when the remote store cannot be set up", async () => {
    const remote = fakeRemote();
    remote.init.mockRejectedValue(new Error("no scripts"));
    const store = openStore(
      () => true,
      () => remote,
    );

    expect((await store.increment("player")).totalHits).toBe(1);
    expect(remote.increment).not.toHaveBeenCalled();
  });

  it("builds the remote store anew once it is back", async () => {
    const remotes = [fakeRemote(), fakeRemote()];
    const createRemote = vi.fn(
      () => remotes[createRemote.mock.calls.length - 1]!,
    );
    let up = true;
    const store = openStore(() => up, createRemote);

    await store.increment("player");
    up = false;
    await store.increment("player");
    up = true;
    await store.increment("player");

    expect(createRemote).toHaveBeenCalledTimes(2);
    expect(remotes[0]!.hits.get("player")).toBe(1);
    expect(remotes[1]!.hits.get("player")).toBe(1);
    expect(remotes[1]!.init).toHaveBeenCalledWith(OPTIONS);
  });

  it("takes a hit back in the store in use", async () => {
    const remote = fakeRemote();
    const store = openStore(
      () => true,
      () => remote,
    );

    await store.increment("player");
    await store.increment("player");
    await store.decrement("player");

    expect((await store.get("player"))?.totalHits).toBe(1);
  });

  it("forgets a client in both stores", async () => {
    const remote = fakeRemote();
    let up = false;
    const store = openStore(
      () => up,
      () => remote,
    );

    await store.increment("player");
    up = true;
    await store.increment("player");
    await store.resetKey("player");

    expect(await store.get("player")).toBeUndefined();
    up = false;
    expect(await store.get("player")).toBeUndefined();
  });
});
