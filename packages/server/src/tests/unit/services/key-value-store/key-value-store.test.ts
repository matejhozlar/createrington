import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryKeyValueStore, readThrough } from "@/services/key-value-store";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MemoryKeyValueStore", () => {
  it("has nothing under a key that was never written", async () => {
    expect(await new MemoryKeyValueStore().get("missing")).toBeNull();
  });

  it("keeps a value until its time is up", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("key", "value", 1000);

    vi.advanceTimersByTime(999);
    expect(await store.get("key")).toBe("value");

    vi.advanceTimersByTime(1);
    expect(await store.get("key")).toBeNull();
  });

  it("replaces a value and its time limit", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("key", "first", 1000);
    await store.set("key", "second", 5000);

    vi.advanceTimersByTime(2000);
    expect(await store.get("key")).toBe("second");
  });

  it("drops the value written longest ago when it is full", async () => {
    const store = new MemoryKeyValueStore(2);
    await store.set("a", "1", 1000);
    await store.set("b", "2", 1000);
    await store.set("c", "3", 1000);

    expect(await store.get("a")).toBeNull();
    expect(await store.get("b")).toBe("2");
    expect(await store.get("c")).toBe("3");
  });

  it("drops expired values before live ones when it is full", async () => {
    const store = new MemoryKeyValueStore(2);
    await store.set("old", "1", 5000);
    await store.set("expired", "2", 100);
    vi.advanceTimersByTime(200);
    await store.set("new", "3", 5000);

    expect(await store.get("old")).toBe("1");
    expect(await store.get("new")).toBe("3");
  });

  it("does not count a rewritten key twice", async () => {
    const store = new MemoryKeyValueStore(2);
    await store.set("a", "1", 1000);
    await store.set("b", "2", 1000);
    await store.set("b", "3", 1000);

    expect(await store.get("a")).toBe("1");
    expect(await store.get("b")).toBe("3");
  });
});

describe("readThrough", () => {
  it("loads a missing value once and answers from the store afterwards", async () => {
    const store = new MemoryKeyValueStore();
    const load = vi.fn(async () => ({ answer: 42 }));

    expect(await readThrough(store, "once", 1000, load)).toEqual({
      answer: 42,
    });
    expect(await readThrough(store, "once", 1000, load)).toEqual({
      answer: 42,
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again once the stored value's time is up", async () => {
    const store = new MemoryKeyValueStore();
    const load = vi.fn(async () => "value");

    await readThrough(store, "expiring", 1000, load);
    vi.advanceTimersByTime(1000);
    await readThrough(store, "expiring", 1000, load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("stores a null result like any other", async () => {
    const store = new MemoryKeyValueStore();
    const load = vi.fn(async () => null);

    expect(await readThrough(store, "nothing", 1000, load)).toBeNull();
    expect(await readThrough(store, "nothing", 1000, load)).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one load between callers that miss at the same time", async () => {
    const store = new MemoryKeyValueStore();
    let finish: (value: string) => void = () => {};
    const load = vi.fn(
      () => new Promise<string>((resolve) => (finish = resolve)),
    );

    const first = readThrough(store, "shared", 1000, load);
    const second = readThrough(store, "shared", 1000, load);
    await vi.advanceTimersByTimeAsync(0);
    finish("value");

    expect(await Promise.all([first, second])).toEqual(["value", "value"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("stores nothing when the load fails, and loads again next time", async () => {
    const store = new MemoryKeyValueStore();
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce("value");

    await expect(readThrough(store, "flaky", 1000, load)).rejects.toThrow(
      "down",
    );
    expect(await readThrough(store, "flaky", 1000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
