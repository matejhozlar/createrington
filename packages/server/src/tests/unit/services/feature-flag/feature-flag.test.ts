import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { find, upsert, orderBy, all } = vi.hoisted(() => ({
  find: vi.fn(),
  upsert: vi.fn(),
  orderBy: vi.fn(),
  all: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: { feature: { flag: { find, upsert, orderBy } } },
}));

import { FeatureFlagService } from "@/services/feature-flag";

const FLAG = "gallery";

let service: FeatureFlagService;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-08T12:00:00Z"));
  vi.clearAllMocks();
  find.mockResolvedValue({ name: FLAG, enabled: true });
  upsert.mockResolvedValue({ name: FLAG, enabled: false });
  orderBy.mockReturnValue({ all });
  service = new FeatureFlagService();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("FeatureFlagService.isEnabled", () => {
  it("reads the flag from the table", async () => {
    await expect(service.isEnabled(FLAG)).resolves.toBe(true);
    expect(find).toHaveBeenCalledWith({ name: FLAG });
  });

  it("treats a flag that does not exist as disabled", async () => {
    find.mockResolvedValue(null);

    await expect(service.isEnabled(FLAG)).resolves.toBe(false);
  });

  it("fails closed when the read fails", async () => {
    find.mockRejectedValue(new Error("connection lost"));

    await expect(service.isEnabled(FLAG)).resolves.toBe(false);
  });

  it("serves a cached value for ten seconds, then reads again", async () => {
    await service.isEnabled(FLAG);
    vi.advanceTimersByTime(9_999);
    await service.isEnabled(FLAG);
    expect(find).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    await service.isEnabled(FLAG);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed read", async () => {
    find.mockRejectedValueOnce(new Error("connection lost"));

    await expect(service.isEnabled(FLAG)).resolves.toBe(false);
    await expect(service.isEnabled(FLAG)).resolves.toBe(true);
    expect(find).toHaveBeenCalledTimes(2);
  });
});

describe("FeatureFlagService.readEnabled", () => {
  it("returns null instead of false when the flag could not be read", async () => {
    find.mockRejectedValue(new Error("connection lost"));

    await expect(service.readEnabled(FLAG)).resolves.toBeNull();
  });

  it("returns false for a flag that is stored as disabled", async () => {
    find.mockResolvedValue({ name: FLAG, enabled: false });

    await expect(service.readEnabled(FLAG)).resolves.toBe(false);
  });
});

describe("FeatureFlagService.setEnabled", () => {
  it("upserts the flag and drops the cached value at once", async () => {
    await service.isEnabled(FLAG);
    find.mockResolvedValue({ name: FLAG, enabled: false });

    await service.setEnabled(FLAG, false);

    expect(upsert).toHaveBeenCalledWith(
      { name: FLAG, enabled: false, updatedAt: new Date() },
      "name",
      ["enabled", "updatedAt"],
    );
    await expect(service.isEnabled(FLAG)).resolves.toBe(false);
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("updates the description only when one is given", async () => {
    await service.setEnabled(FLAG, true, "Screenshot gallery");

    expect(upsert).toHaveBeenCalledWith(
      {
        name: FLAG,
        enabled: true,
        description: "Screenshot gallery",
        updatedAt: new Date(),
      },
      "name",
      ["enabled", "description", "updatedAt"],
    );
  });
});

describe("FeatureFlagService.list", () => {
  it("lists every flag ordered by name", async () => {
    all.mockResolvedValue([{ name: "gallery" }, { name: "workshop" }]);

    await expect(service.list()).resolves.toEqual([
      { name: "gallery" },
      { name: "workshop" },
    ]);
    expect(orderBy).toHaveBeenCalledWith("name");
  });
});
