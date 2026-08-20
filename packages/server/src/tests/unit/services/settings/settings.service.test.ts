import { describe, it, expect, beforeEach, vi } from "vitest";

type StoredRow = {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy: string | null;
};

const state = vi.hoisted(() => ({
  store: new Map<string, StoredRow>(),
  findCalls: 0,
  failReads: false,
}));

vi.mock("@/db", () => ({
  Q: {
    app: {
      setting: {
        find: async ({ key }: { key: string }) => {
          state.findCalls++;
          if (state.failReads) throw new Error("connection refused");
          return state.store.get(key) ?? null;
        },
        upsert: async (data: StoredRow) => {
          state.store.set(data.key, data);
          return data;
        },
      },
    },
  },
}));

vi.mock("@/config", () => ({
  default: { servers: { playerLimit: 100 } },
}));

import { SettingsService } from "@/services/settings";

function seed(key: string, value: unknown): void {
  state.store.set(key, {
    key,
    value,
    updatedAt: new Date(),
    updatedBy: "admin-1",
  });
}

beforeEach(() => {
  state.store = new Map();
  state.findCalls = 0;
  state.failReads = false;
});

describe("SettingsService", () => {
  it("falls back to the configured player limit when no row exists", async () => {
    const svc = new SettingsService();
    expect(await svc.getPlayerLimit()).toBe(100);
    expect(await svc.getIntakeMode()).toBe("auto");
  });

  it("reads values out of the { value } envelope", async () => {
    seed("player_limit", { value: 40 });
    seed("intake_mode", { value: "closed" });
    const svc = new SettingsService();
    expect(await svc.getPlayerLimit()).toBe(40);
    expect(await svc.getIntakeMode()).toBe("closed");
  });

  it("uses the fallback when the stored value fails validation", async () => {
    seed("player_limit", { value: 5000 });
    seed("intake_mode", { value: "maybe" });
    const svc = new SettingsService();
    expect(await svc.getPlayerLimit()).toBe(100);
    expect(await svc.getIntakeMode()).toBe("auto");
  });

  it("uses the fallback when the row is not wrapped in the envelope", async () => {
    seed("player_limit", 40);
    const svc = new SettingsService();
    expect(await svc.getPlayerLimit()).toBe(100);
  });

  it("uses the fallback when the read fails", async () => {
    state.failReads = true;
    const svc = new SettingsService();
    expect(await svc.getPlayerLimit()).toBe(100);
  });

  it("serves repeated reads from the cache", async () => {
    seed("player_limit", { value: 40 });
    const svc = new SettingsService();
    await svc.getPlayerLimit();
    await svc.getPlayerLimit();
    expect(state.findCalls).toBe(1);
  });

  it("writes the envelope and invalidates the cache", async () => {
    const svc = new SettingsService();
    expect(await svc.getPlayerLimit()).toBe(100);

    await svc.setPlayerLimit(25, "admin-1");

    expect(state.store.get("player_limit")?.value).toEqual({ value: 25 });
    expect(state.store.get("player_limit")?.updatedBy).toBe("admin-1");
    expect(await svc.getPlayerLimit()).toBe(25);
    expect(state.findCalls).toBe(2);
  });

  it("rejects out-of-range writes before touching the store", async () => {
    const svc = new SettingsService();
    await expect(svc.setPlayerLimit(1001, "admin-1")).rejects.toThrow();
    await expect(svc.setPlayerLimit(-1, "admin-1")).rejects.toThrow();
    await expect(svc.setPlayerLimit(2.5, "admin-1")).rejects.toThrow();
    expect(state.store.size).toBe(0);
  });
});
