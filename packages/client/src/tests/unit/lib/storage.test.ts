import { afterEach, describe, expect, it, vi } from "vitest";
import { localStore, sessionStore } from "@/lib/storage";

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

function throwingStorage(): Storage {
  const fail = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  return {
    length: 0,
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}

describe("safe storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips strings and JSON", () => {
    vi.stubGlobal("localStorage", memoryStorage());

    expect(localStore.set("name", "steve")).toBe(true);
    expect(localStore.setJson("pins", ["/a", "/b"])).toBe(true);

    expect(localStore.get("name")).toBe("steve");
    expect(localStore.getJson("pins")).toEqual(["/a", "/b"]);
  });

  it("returns null for a missing key or a value that is not JSON", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    localStore.set("broken", "{not json");

    expect(localStore.get("missing")).toBeNull();
    expect(localStore.getJson("missing")).toBeNull();
    expect(localStore.getJson("broken")).toBeNull();
  });

  it("removes a key", () => {
    vi.stubGlobal("sessionStorage", memoryStorage());
    sessionStore.set("state", "1");

    sessionStore.remove("state");

    expect(sessionStore.get("state")).toBeNull();
  });

  it("keeps local and session storage apart", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("sessionStorage", memoryStorage());

    localStore.set("key", "local");

    expect(sessionStore.get("key")).toBeNull();
  });

  it("never throws when storage is blocked, and reports failed writes", () => {
    vi.stubGlobal("localStorage", throwingStorage());

    expect(localStore.get("key")).toBeNull();
    expect(localStore.getJson("key")).toBeNull();
    expect(localStore.set("key", "value")).toBe(false);
    expect(localStore.setJson("key", { a: 1 })).toBe(false);
    expect(() => localStore.remove("key")).not.toThrow();
  });

  it("never throws when storage does not exist", () => {
    expect(localStore.get("key")).toBeNull();
    expect(localStore.set("key", "value")).toBe(false);
  });
});
