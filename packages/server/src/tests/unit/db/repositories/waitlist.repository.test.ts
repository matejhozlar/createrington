import { describe, it, expect, beforeEach, vi } from "vitest";

type EntryRow = {
  status: string;
  joinedMinecraft: boolean;
  createdAt: Date;
  queuedAt: Date;
};

type CountFilters = {
  status?: string;
  joinedMinecraft?: boolean;
  createdAt?: { $gte: Date };
  queuedAt?: { $gte: Date };
};

const state = vi.hoisted(() => ({
  intakeMode: "auto" as "auto" | "closed",
  playerLimit: 10,
  playerCount: 0,
  promotedCount: 0,
  failLimitRead: false,
  rows: [] as EntryRow[],
  countCalls: [] as CountFilters[],
}));

// Counts against `rows` so getStats can be driven by fixtures; getFreeSlots
// predates them and still reads promotedCount when no rows are seeded.
vi.mock("@/db", () => ({
  db: {},
  Q: {
    player: { count: async () => state.playerCount },
    waitlist: {
      entry: {
        count: async (filters: CountFilters = {}) => {
          state.countCalls.push(filters);
          if (state.rows.length === 0) {
            return filters.status === "promoted" ? state.promotedCount : 0;
          }
          return state.rows.filter((row) => {
            if (filters.status && row.status !== filters.status) return false;
            if (
              filters.joinedMinecraft !== undefined &&
              row.joinedMinecraft !== filters.joinedMinecraft
            ) {
              return false;
            }
            if (filters.createdAt && row.createdAt < filters.createdAt.$gte) {
              return false;
            }
            if (filters.queuedAt && row.queuedAt < filters.queuedAt.$gte) {
              return false;
            }
            return true;
          }).length;
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
  state.rows = [];
  state.countCalls = [];
});

const DAY_MS = 24 * 60 * 60 * 1000;

function entry(overrides: Partial<EntryRow> = {}): EntryRow {
  const now = new Date();
  return {
    status: "queued",
    joinedMinecraft: false,
    createdAt: now,
    queuedAt: now,
    ...overrides,
  };
}

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
  it("counts an entry once, on the day it first signed up", async () => {
    const now = new Date();
    state.rows = [
      entry({
        createdAt: new Date(now.getTime() - 40 * DAY_MS),
        queuedAt: now,
      }),
      entry({
        createdAt: new Date(now.getTime() - 20 * DAY_MS),
        queuedAt: now,
      }),
      entry({ createdAt: now, queuedAt: now }),
    ];

    const stats = await new WaitlistRepository().getStats();

    expect(stats.signups).toEqual({ today: 1, thisWeek: 1, thisMonth: 2 });
  });

  it("never derives a signup window from queuedAt", async () => {
    state.rows = [entry()];

    await new WaitlistRepository().getStats();

    expect(state.countCalls.filter((filters) => "queuedAt" in filters)).toEqual(
      [],
    );
    expect(
      state.countCalls.filter((filters) => "createdAt" in filters),
    ).toHaveLength(3);
  });

  it("widens each window to the entries that signed up inside it", async () => {
    const now = new Date();
    state.rows = [
      entry({ createdAt: now }),
      entry({ createdAt: new Date(now.getTime() - 2 * DAY_MS) }),
      entry({ createdAt: new Date(now.getTime() - 20 * DAY_MS) }),
      entry({ createdAt: new Date(now.getTime() - 40 * DAY_MS) }),
    ];

    const stats = await new WaitlistRepository().getStats();

    expect(stats.signups).toEqual({ today: 1, thisWeek: 2, thisMonth: 3 });
  });

  it("reports status and milestone breakdowns alongside the windows", async () => {
    state.rows = [
      entry({ status: "queued" }),
      entry({ status: "promoted" }),
      entry({ status: "registered", joinedMinecraft: true }),
      entry({ status: "expired" }),
    ];

    const stats = await new WaitlistRepository().getStats();

    expect(stats).toMatchObject({
      total: 4,
      queued: 1,
      promoted: 1,
      registered: 1,
      expired: 1,
      joinedMinecraft: 1,
    });
  });
});
