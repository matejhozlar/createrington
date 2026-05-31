import { describe, it, expect, beforeEach, vi } from "vitest";

type StoredRow = {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedByDiscordId: string | null;
};

let store: Map<string, StoredRow>;

vi.mock("@/db", () => {
  // Minimal Q.crypto.setting stub mirroring the methods the service uses.
  const setting = {
    getAll: async () => Array.from(store.values()),
    upsert: async (data: Partial<StoredRow> & { key: string }) => {
      store.set(data.key, {
        key: data.key,
        value: data.value,
        updatedAt: data.updatedAt ?? new Date(),
        updatedByDiscordId: data.updatedByDiscordId ?? null,
      });
    },
    delete: async (id: { key: string }) => {
      store.delete(id.key);
    },
    drop: async () => {
      const n = store.size;
      store.clear();
      return n;
    },
  };
  return { Q: { crypto: { setting } } };
});

import { CryptoSettingsService } from "@/services/crypto/settings/crypto-settings.service";
import { SETTINGS_REGISTRY } from "@/services/crypto/settings/registry";

beforeEach(() => {
  store = new Map();
});

describe("CryptoSettingsService", () => {
  it("returns the compiled default when no override is stored", async () => {
    const svc = new CryptoSettingsService();
    await svc.initialize();
    expect(svc.get("MEMECOIN_MAX_ACTIVE")).toBe(
      SETTINGS_REGISTRY.MEMECOIN_MAX_ACTIVE.defaultValue,
    );
    expect(svc.isOverridden("MEMECOIN_MAX_ACTIVE")).toBe(false);
  });

  it("loads existing overrides on initialize", async () => {
    store.set("MEMECOIN_MAX_ACTIVE", {
      key: "MEMECOIN_MAX_ACTIVE",
      value: { v: 12 },
      updatedAt: new Date(),
      updatedByDiscordId: "admin-1",
    });
    const svc = new CryptoSettingsService();
    await svc.initialize();
    expect(svc.get("MEMECOIN_MAX_ACTIVE")).toBe(12);
    expect(svc.isOverridden("MEMECOIN_MAX_ACTIVE")).toBe(true);
  });

  it("set() persists, validates, and emits setting:changed", async () => {
    const svc = new CryptoSettingsService();
    await svc.initialize();

    const events: unknown[] = [];
    svc.on("setting:changed", (e) => events.push(e));

    const result = await svc.set("MEMECOIN_MAX_ACTIVE", 7, "admin-1");
    expect(result.newValue).toBe(7);
    expect(svc.get("MEMECOIN_MAX_ACTIVE")).toBe(7);
    expect(store.get("MEMECOIN_MAX_ACTIVE")?.value).toEqual({ v: 7 });
    expect(events).toHaveLength(1);
  });

  it("set() rejects invalid values without writing", async () => {
    const svc = new CryptoSettingsService();
    await svc.initialize();
    await expect(svc.set("MEMECOIN_MAX_ACTIVE", -1, null)).rejects.toThrow();
    expect(store.has("MEMECOIN_MAX_ACTIVE")).toBe(false);
  });

  it("reset() removes the row and falls back to the default", async () => {
    store.set("MEMECOIN_MAX_ACTIVE", {
      key: "MEMECOIN_MAX_ACTIVE",
      value: { v: 12 },
      updatedAt: new Date(),
      updatedByDiscordId: null,
    });
    const svc = new CryptoSettingsService();
    await svc.initialize();

    await svc.reset("MEMECOIN_MAX_ACTIVE", "admin-1");
    expect(store.has("MEMECOIN_MAX_ACTIVE")).toBe(false);
    expect(svc.get("MEMECOIN_MAX_ACTIVE")).toBe(
      SETTINGS_REGISTRY.MEMECOIN_MAX_ACTIVE.defaultValue,
    );
  });

  it("resetAll() clears every override and emits one event per cleared key", async () => {
    store.set("MEMECOIN_MAX_ACTIVE", {
      key: "MEMECOIN_MAX_ACTIVE",
      value: { v: 12 },
      updatedAt: new Date(),
      updatedByDiscordId: null,
    });
    store.set("cryptoEnabled", {
      key: "cryptoEnabled",
      value: { v: false },
      updatedAt: new Date(),
      updatedByDiscordId: null,
    });
    const svc = new CryptoSettingsService();
    await svc.initialize();

    const events: unknown[] = [];
    svc.on("setting:changed", (e) => events.push(e));

    const cleared = await svc.resetAll("admin-1");
    expect(cleared).toBe(2);
    expect(store.size).toBe(0);
    expect(events).toHaveLength(2);
    expect(svc.get("cryptoEnabled")).toBe(true);
  });

  it("list() reports current vs default and override flag", async () => {
    store.set("MEMECOIN_MAX_ACTIVE", {
      key: "MEMECOIN_MAX_ACTIVE",
      value: { v: 8 },
      updatedAt: new Date(),
      updatedByDiscordId: null,
    });
    const svc = new CryptoSettingsService();
    await svc.initialize();
    const entries = svc.list();
    const mma = entries.find((e) => e.key === "MEMECOIN_MAX_ACTIVE")!;
    expect(mma.currentValue).toBe(8);
    expect(mma.defaultValue).toBe(
      SETTINGS_REGISTRY.MEMECOIN_MAX_ACTIVE.defaultValue,
    );
    expect(mma.isOverridden).toBe(true);
  });

  it("master toggle defaults to enabled", async () => {
    const svc = new CryptoSettingsService();
    await svc.initialize();
    expect(svc.get("cryptoEnabled")).toBe(true);
    await svc.set("cryptoEnabled", false, "admin-1");
    expect(svc.get("cryptoEnabled")).toBe(false);
  });

  it("rejects min > max across paired keys", async () => {
    const svc = new CryptoSettingsService();
    await svc.initialize();
    await svc.set("MEMECOIN_INITIAL_PRICE_MAX", 50, null);
    await expect(
      svc.set("MEMECOIN_INITIAL_PRICE_MIN", 200, null),
    ).rejects.toThrow(/cannot exceed/);
  });

  it("ignores unknown override rows on initialize", async () => {
    store.set("not-a-real-key", {
      key: "not-a-real-key",
      value: { v: 123 },
      updatedAt: new Date(),
      updatedByDiscordId: null,
    });
    const svc = new CryptoSettingsService();
    await svc.initialize();
    // No throw; known keys still return defaults
    expect(svc.get("MEMECOIN_MAX_ACTIVE")).toBe(
      SETTINGS_REGISTRY.MEMECOIN_MAX_ACTIVE.defaultValue,
    );
  });
});
