import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FallbackKeyValueStore,
  MemoryKeyValueStore,
  RedisKeyValueStore,
  readStored,
  readThrough,
  writeStored,
  type KeyValueStore,
} from "@/services/key-value-store";

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

describe("RedisKeyValueStore", () => {
  function fakeRedis(reply: unknown = null) {
    return { sendCommand: vi.fn(async (_args: string[]) => reply) };
  }

  it("reads the value Redis holds under the key", async () => {
    const redis = fakeRedis("value");

    expect(await new RedisKeyValueStore(redis).get("key")).toBe("value");
    expect(redis.sendCommand).toHaveBeenCalledWith(["GET", "key"]);
  });

  it("has nothing under a key Redis does not hold", async () => {
    expect(await new RedisKeyValueStore(fakeRedis(null)).get("key")).toBeNull();
  });

  it("writes a value with its time limit in milliseconds", async () => {
    const redis = fakeRedis("OK");

    await new RedisKeyValueStore(redis).set("key", "value", 1500);

    expect(redis.sendCommand).toHaveBeenCalledWith([
      "SET",
      "key",
      "value",
      "PX",
      "1500",
    ]);
  });

  it("keeps a value for at least one whole millisecond", async () => {
    const redis = fakeRedis("OK");

    await new RedisKeyValueStore(redis).set("key", "value", 0.2);

    expect(redis.sendCommand).toHaveBeenCalledWith([
      "SET",
      "key",
      "value",
      "PX",
      "1",
    ]);
  });

  it("fails when Redis fails", async () => {
    const redis = {
      sendCommand: vi.fn(async () => {
        throw new Error("Redis is not connected");
      }),
    };

    await expect(new RedisKeyValueStore(redis).get("key")).rejects.toThrow(
      "Redis is not connected",
    );
  });
});

describe("FallbackKeyValueStore", () => {
  const failing: KeyValueStore = {
    get: async () => {
      throw new Error("store down");
    },
    set: async () => {
      throw new Error("store down");
    },
  };

  it("uses the primary while it is up", async () => {
    const primary = new MemoryKeyValueStore();
    const fallback = new MemoryKeyValueStore();
    const store = new FallbackKeyValueStore(primary, fallback, () => true);

    await store.set("key", "value", 1000);

    expect(await store.get("key")).toBe("value");
    expect(await primary.get("key")).toBe("value");
    expect(await fallback.get("key")).toBeNull();
  });

  it("uses the fallback while the primary is down", async () => {
    const primary = new MemoryKeyValueStore();
    const fallback = new MemoryKeyValueStore();
    const store = new FallbackKeyValueStore(primary, fallback, () => false);

    await store.set("key", "value", 1000);

    expect(await store.get("key")).toBe("value");
    expect(await primary.get("key")).toBeNull();
    expect(await fallback.get("key")).toBe("value");
  });

  it("answers from the fallback when the primary fails", async () => {
    const fallback = new MemoryKeyValueStore();
    const store = new FallbackKeyValueStore(failing, fallback, () => true);

    await store.set("key", "value", 1000);

    expect(await store.get("key")).toBe("value");
    expect(await fallback.get("key")).toBe("value");
  });

  it("goes back to the primary once it is up again", async () => {
    const primary = new MemoryKeyValueStore();
    const fallback = new MemoryKeyValueStore();
    let up = false;
    const store = new FallbackKeyValueStore(primary, fallback, () => up);

    await store.set("key", "written while down", 1000);
    up = true;
    await store.set("key", "written while up", 1000);

    expect(await store.get("key")).toBe("written while up");
    expect(await primary.get("key")).toBe("written while up");
  });

  it("keeps a cache working through readThrough while the primary is down", async () => {
    const store = new FallbackKeyValueStore(
      failing,
      new MemoryKeyValueStore(),
      () => false,
    );
    const load = vi.fn(async () => "value");

    expect(await readThrough(store, "cached", 1000, load)).toBe("value");
    expect(await readThrough(store, "cached", 1000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
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

describe("a store that fails", () => {
  const failing: KeyValueStore = {
    get: async () => {
      throw new Error("store down");
    },
    set: async () => {
      throw new Error("store down");
    },
  };

  it("reads as nothing stored", async () => {
    expect(await readStored(failing, "key")).toBeUndefined();
  });

  it("skips the write without failing", async () => {
    await expect(
      writeStored(failing, "key", { answer: 42 }, 1000),
    ).resolves.toBeUndefined();
  });

  it("only costs a load in readThrough", async () => {
    const load = vi.fn(async () => "value");

    expect(await readThrough(failing, "down", 1000, load)).toBe("value");
    expect(await readThrough(failing, "down", 1000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("readStored", () => {
  it("tells a stored null from nothing stored", async () => {
    const store = new MemoryKeyValueStore();
    await writeStored(store, "null", null, 1000);

    expect(await readStored(store, "null")).toBeNull();
    expect(await readStored(store, "missing")).toBeUndefined();
  });

  it("reads something that is not JSON as nothing stored", async () => {
    const store = new MemoryKeyValueStore();
    await store.set("broken", "{not json", 1000);

    expect(await readStored(store, "broken")).toBeUndefined();
  });
});
