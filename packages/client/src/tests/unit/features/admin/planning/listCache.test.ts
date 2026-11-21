import { describe, expect, it } from "vitest";
import { patchListItem } from "@/features/admin/planning/listCache";
import type { PlanningItem } from "@/features/admin/planning/types";

function card(id: number, overrides: Partial<PlanningItem> = {}): PlanningItem {
  return {
    id,
    title: `Card ${id}`,
    body: null,
    category: "modpack",
    subcategoryId: null,
    status: "discussing",
    decision: null,
    revision: 1,
    createdAt: "2026-11-21T00:00:00.000Z",
    updatedAt: "2026-11-21T00:00:00.000Z",
    createdBy: { discordId: "1", minecraftUuid: null, minecraftUsername: null },
    assignees: [],
    commentCount: 0,
    ...overrides,
  };
}

describe("patchListItem", () => {
  it("moves one card and leaves the others as they were", () => {
    const list = { items: [card(1), card(2)] };

    const moved = patchListItem(list, 2, { status: "building" });

    expect(moved?.items.map((item) => item.status)).toEqual([
      "discussing",
      "building",
    ]);
    expect(moved?.items[0]).toBe(list.items[0]);
  });

  it("carries the saved revision so the next move is based on it", () => {
    const moved = patchListItem({ items: [card(1)] }, 1, {
      status: "building",
    });

    const confirmed = patchListItem(moved, 1, { revision: 2 });

    expect(confirmed?.items[0]).toMatchObject({
      status: "building",
      revision: 2,
    });
  });

  it("stays empty while the list has not loaded", () => {
    expect(patchListItem(undefined, 1, { revision: 2 })).toBeUndefined();
  });
});
