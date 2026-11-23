import { describe, it, expect, beforeEach, vi } from "vitest";
import type { IntakeMode } from "@/services/settings";

type State = {
  intakeMode: IntakeMode;
  playerLimit: number;
  playerCount: number;
  promotedCount: number;
  failLimitRead: boolean;
};

const state = vi.hoisted((): State => ({
  intakeMode: "auto",
  playerLimit: 10,
  playerCount: 0,
  promotedCount: 0,
  failLimitRead: false,
}));

vi.mock("@/db", () => ({
  Q: {
    player: { count: async () => state.playerCount },
    waitlist: {
      entry: {
        count: async (filters: { status?: string } = {}) =>
          filters.status === "promoted" ? state.promotedCount : 0,
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

import { WaitlistCapacityService } from "@/services/waitlist/capacity.service";

beforeEach(() => {
  state.intakeMode = "auto";
  state.playerLimit = 10;
  state.playerCount = 0;
  state.promotedCount = 0;
  state.failLimitRead = false;
});

describe("WaitlistCapacityService.getFreeSlots", () => {
  it("subtracts players and outstanding promotions from the limit", async () => {
    state.playerCount = 6;
    state.promotedCount = 3;
    const capacity = new WaitlistCapacityService();
    expect(await capacity.getFreeSlots()).toBe(1);
    expect(await capacity.hasCapacity()).toBe(true);
  });

  it("treats reserved slots as taken", async () => {
    state.playerCount = 9;
    state.promotedCount = 1;
    const capacity = new WaitlistCapacityService();
    expect(await capacity.getFreeSlots()).toBe(0);
    expect(await capacity.hasCapacity()).toBe(false);
  });

  it("never goes negative when the limit is lowered below the player count", async () => {
    state.playerLimit = 5;
    state.playerCount = 8;
    const capacity = new WaitlistCapacityService();
    expect(await capacity.getFreeSlots()).toBe(0);
  });

  it("reports zero while intake is closed regardless of capacity", async () => {
    state.intakeMode = "closed";
    const capacity = new WaitlistCapacityService();
    expect(await capacity.getFreeSlots()).toBe(0);
    expect(await capacity.hasCapacity()).toBe(false);
  });

  it("fails closed when the settings read throws", async () => {
    state.failLimitRead = true;
    const capacity = new WaitlistCapacityService();
    await expect(capacity.getFreeSlots()).rejects.toThrow(
      "settings unavailable",
    );
    expect(await capacity.hasCapacity()).toBe(false);
  });
});
