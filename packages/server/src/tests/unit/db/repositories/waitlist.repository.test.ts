import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  intakeMode: "auto" as "auto" | "closed",
  playerLimit: 10,
  playerCount: 0,
  promotedCount: 0,
  failLimitRead: false,
}));

vi.mock("@/db", () => ({
  db: {},
  Q: {
    player: { count: async () => state.playerCount },
    waitlist: {
      entry: {
        count: async ({ status }: { status: string }) =>
          status === "promoted" ? state.promotedCount : 0,
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
