import { describe, it, expect, beforeEach, vi } from "vitest";

type FunnelStats = {
  total: number;
  queued: number;
  promoted: number;
  registered: number;
  expired: number;
  joinedMinecraft: number;
  signups: { today: number; thisWeek: number; thisMonth: number };
};

const ZERO_STATS: FunnelStats = {
  total: 0,
  queued: 0,
  promoted: 0,
  registered: 0,
  expired: 0,
  joinedMinecraft: 0,
  signups: { today: 0, thisWeek: 0, thisMonth: 0 },
};

const state = vi.hoisted(() => ({
  intakeMode: "auto" as "auto" | "closed",
  playerLimit: 10,
  playerCount: 0,
  promotedCount: 0,
  failLimitRead: false,
  funnelStats: {} as FunnelStats,
  funnelCalls: 0,
}));

vi.mock("@/db", () => ({
  db: {},
  Q: {
    player: { count: async () => state.playerCount },
    waitlist: {
      entry: {
        count: async (filters: { status?: string } = {}) =>
          filters.status === "promoted" ? state.promotedCount : 0,
        getFunnelStats: async () => {
          state.funnelCalls += 1;
          return state.funnelStats;
        },
      },
    },
  },
}));

vi.mock("@/services/settings", () => ({
  settings: {
    getIntakeMode: async () => state.intakeMode,
    getPlayerLimit: async () => {
      if (state.failLimitRead) throw new Error("settings unavailable");
      return state.playerLimit;
    },
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: { administration: { NOTIFICATIONS: "notifications" } },
    Users: { fetch: async () => null },
    Messages: { edit: async () => ({ success: true }) },
  },
}));
vi.mock("@/discord/embeds", () => ({ EmbedPresets: {} }));
vi.mock("@/discord/embeds/presets/buttons", () => ({
  ButtonPresets: { links: { adminPanel: () => ({}) } },
}));
vi.mock("@/generated/db", () => ({
  DatabaseTable: { WAITLIST_ENTRY: { TABLE: "waitlist_entry" } },
}));
vi.mock("@/types", () => ({
  AdminEdit: { DELETE_WAITLIST: "delete_waitlist" },
}));

import { WaitlistRepository } from "@/db/repositories/waitlist";

beforeEach(() => {
  state.intakeMode = "auto";
  state.playerLimit = 10;
  state.playerCount = 0;
  state.promotedCount = 0;
  state.failLimitRead = false;
  state.funnelStats = ZERO_STATS;
  state.funnelCalls = 0;
});

describe("WaitlistRepository.getFreeSlots", () => {
  it("subtracts players and outstanding promotions from the limit", async () => {
    state.playerCount = 6;
    state.promotedCount = 3;
    const repo = new WaitlistRepository();
    expect(await repo.getFreeSlots()).toBe(1);
    expect(await repo.hasCapacity()).toBe(true);
  });

  it("treats reserved slots as taken", async () => {
    state.playerCount = 9;
    state.promotedCount = 1;
    const repo = new WaitlistRepository();
    expect(await repo.getFreeSlots()).toBe(0);
    expect(await repo.hasCapacity()).toBe(false);
  });

  it("never goes negative when the limit is lowered below the player count", async () => {
    state.playerLimit = 5;
    state.playerCount = 8;
    const repo = new WaitlistRepository();
    expect(await repo.getFreeSlots()).toBe(0);
  });

  it("reports zero while intake is closed regardless of capacity", async () => {
    state.intakeMode = "closed";
    const repo = new WaitlistRepository();
    expect(await repo.getFreeSlots()).toBe(0);
    expect(await repo.hasCapacity()).toBe(false);
  });

  it("fails closed when the settings read throws", async () => {
    state.failLimitRead = true;
    const repo = new WaitlistRepository();
    await expect(repo.getFreeSlots()).rejects.toThrow("settings unavailable");
    expect(await repo.hasCapacity()).toBe(false);
  });
});

describe("WaitlistRepository.getStats", () => {
  it("returns the funnel counts unchanged, from a single query", async () => {
    state.funnelStats = {
      total: 4,
      queued: 1,
      promoted: 1,
      registered: 1,
      expired: 1,
      joinedMinecraft: 1,
      signups: { today: 1, thisWeek: 2, thisMonth: 3 },
    };

    const stats = await new WaitlistRepository().getStats();

    expect(stats).toEqual(state.funnelStats);
    expect(state.funnelCalls).toBe(1);
  });
});
