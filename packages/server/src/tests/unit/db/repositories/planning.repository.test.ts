import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestError, ConflictError } from "@/errors";
import type { PlanningItemContent } from "@/db/repositories/planning";

interface ItemRow extends PlanningItemContent {
  id: number;
  revision: number;
  createdBy: string;
  updatedBy: string;
}

interface RevisionRow extends PlanningItemContent {
  id: number;
  itemId: number;
  revision: number;
  editedBy: string;
}

interface AssigneeRow {
  itemId: number;
  discordId: string;
  assignedBy: string;
}

const state = vi.hoisted(() => ({
  items: new Map<number, ItemRow>(),
  revisions: [] as RevisionRow[],
  assignees: [] as AssigneeRow[],
  subcategories: new Map<number, { id: number; category: string }>(),
  admins: new Set<string>(),
  nextId: 1,
}));

vi.mock("@/db", () => {
  const tx = {
    admin: {
      findAll: async (filters: { discordId: { $in: string[] } }) =>
        filters.discordId.$in
          .filter((discordId) => state.admins.has(discordId))
          .map((discordId) => ({ discordId })),
    },
    planning: {
      subcategory: {
        find: async ({ id }: { id: number }) =>
          state.subcategories.get(id) ?? null,
        delete: async ({ id }: { id: number }) => {
          state.subcategories.delete(id);
        },
      },
      item: {
        findAll: async ({ subcategoryId }: { subcategoryId: number }) =>
          [...state.items.values()]
            .filter((item) => item.subcategoryId === subcategoryId)
            .map((item) => ({ ...item })),
        getForUpdate: async (id: number) => {
          const item = state.items.get(id);
          if (!item) throw new Error(`planning_item ${id} not found`);
          return { ...item };
        },
        createAndReturn: async (data: Omit<ItemRow, "id">) => {
          const item = { ...data, id: state.nextId++ };
          state.items.set(item.id, item);
          return { ...item };
        },
        updateAndReturn: async (
          { id }: { id: number },
          updates: Partial<ItemRow>,
        ) => {
          const item = { ...state.items.get(id)!, ...updates };
          state.items.set(id, item);
          return { ...item };
        },
        revision: {
          create: async (data: Omit<RevisionRow, "id">) => {
            state.revisions.push({ ...data, id: state.nextId++ });
          },
          find: async ({ id }: { id: number }) =>
            state.revisions.find((revision) => revision.id === id) ?? null,
        },
        assignee: {
          findAll: async ({ itemId }: { itemId: number }) =>
            state.assignees.filter((row) => row.itemId === itemId),
          deleteAll: async (filters: {
            itemId: number;
            discordId: { $in: string[] };
          }) => {
            state.assignees = state.assignees.filter(
              (row) =>
                row.itemId !== filters.itemId ||
                !filters.discordId.$in.includes(row.discordId),
            );
          },
          createMany: async (rows: AssigneeRow[]) => {
            state.assignees.push(...rows);
          },
        },
      },
    },
  };

  return {
    db: {
      inTransaction: (callback: (t: typeof tx) => unknown) => callback(tx),
    },
  };
});

import { PlanningRepository } from "@/db/repositories/planning";

const ECONOMY = 10;
const LAUNCHER = 20;

const draft: PlanningItemContent = {
  title: "Give money a purpose",
  body: "Nothing worth buying right now",
  category: "modpack",
  subcategoryId: ECONOMY,
  status: "inbox",
  decision: null,
};

const repo = new PlanningRepository();

function revisionsOf(itemId: number): RevisionRow[] {
  return state.revisions.filter((revision) => revision.itemId === itemId);
}

beforeEach(() => {
  state.items.clear();
  state.revisions = [];
  state.assignees = [];
  state.subcategories = new Map([
    [ECONOMY, { id: ECONOMY, category: "modpack" }],
    [LAUNCHER, { id: LAUNCHER, category: "website" }],
  ]);
  state.admins = new Set(["admin-a", "admin-b", "admin-c"]);
  state.nextId = 1;
});

describe("PlanningRepository.createItem", () => {
  it("stores the first revision with the item's content", async () => {
    const item = await repo.createItem(draft, "admin-a");

    expect(item.revision).toBe(1);
    expect(revisionsOf(item.id)).toEqual([
      expect.objectContaining({ ...draft, revision: 1, editedBy: "admin-a" }),
    ]);
  });

  it("keeps the Discord message an item was captured from", async () => {
    const url = "https://discord.com/channels/1/2/3";

    const captured = await repo.createItem(draft, "admin-a", {
      sourceUrl: url,
    });
    const written = await repo.createItem(draft, "admin-a");

    expect(state.items.get(captured.id)).toMatchObject({ sourceUrl: url });
    expect(state.items.get(written.id)).toMatchObject({ sourceUrl: null });
  });

  it("assigns the given admins", async () => {
    const item = await repo.createItem(draft, "admin-a", {
      assigneeIds: ["admin-b"],
    });

    expect(state.assignees).toEqual([
      { itemId: item.id, discordId: "admin-b", assignedBy: "admin-a" },
    ]);
  });

  it("refuses a subcategory from another category", async () => {
    await expect(
      repo.createItem({ ...draft, subcategoryId: LAUNCHER }, "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(state.items.size).toBe(0);
  });
});

describe("PlanningRepository.updateItem", () => {
  it("writes each save as a full copy under the next revision number", async () => {
    const item = await repo.createItem(draft, "admin-a");

    const updated = await repo.updateItem(
      item.id,
      1,
      { status: "decided", decision: "Shops sell claim upgrades" },
      "admin-b",
    );

    expect(updated).toMatchObject({ revision: 2, updatedBy: "admin-b" });
    expect(revisionsOf(item.id)[1]).toMatchObject({
      ...draft,
      status: "decided",
      decision: "Shops sell claim upgrades",
      revision: 2,
      editedBy: "admin-b",
    });
  });

  it("refuses a save based on an outdated revision", async () => {
    const item = await repo.createItem(draft, "admin-a");
    await repo.updateItem(item.id, 1, { title: "First edit" }, "admin-a");

    await expect(
      repo.updateItem(item.id, 1, { title: "Second edit" }, "admin-b"),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(state.items.get(item.id)?.title).toBe("First edit");
    expect(revisionsOf(item.id)).toHaveLength(2);
  });

  it("writes no revision when nothing changed", async () => {
    const item = await repo.createItem(draft, "admin-a");

    const result = await repo.updateItem(
      item.id,
      1,
      { title: draft.title, body: undefined },
      "admin-b",
    );

    expect(result).toMatchObject({ revision: 1, updatedBy: "admin-a" });
    expect(revisionsOf(item.id)).toHaveLength(1);
  });

  it("clears the subcategory when the category moves away from it", async () => {
    const item = await repo.createItem(draft, "admin-a");

    const updated = await repo.updateItem(
      item.id,
      1,
      { category: "website" },
      "admin-a",
    );

    expect(updated).toMatchObject({ category: "website", subcategoryId: null });
  });

  it("refuses an explicitly chosen subcategory from another category", async () => {
    const item = await repo.createItem(draft, "admin-a");

    await expect(
      repo.updateItem(item.id, 1, { subcategoryId: LAUNCHER }, "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("PlanningRepository.restoreItem", () => {
  it("brings back old content as a new revision and keeps the history", async () => {
    const item = await repo.createItem(draft, "admin-a");
    await repo.updateItem(item.id, 1, { title: "Rewritten" }, "admin-b");
    const [first] = revisionsOf(item.id);

    const restored = await repo.restoreItem(item.id, 2, first.id, "admin-c");

    expect(restored).toMatchObject({
      title: draft.title,
      revision: 3,
      updatedBy: "admin-c",
    });
    expect(revisionsOf(item.id).map((revision) => revision.title)).toEqual([
      draft.title,
      "Rewritten",
      draft.title,
    ]);
  });

  it("drops a subcategory that was deleted since that version", async () => {
    const item = await repo.createItem(draft, "admin-a");
    await repo.updateItem(item.id, 1, { subcategoryId: null }, "admin-a");
    state.subcategories.delete(ECONOMY);
    const [first] = revisionsOf(item.id);

    await repo.updateItem(item.id, 2, { title: "Renamed" }, "admin-a");
    const restored = await repo.restoreItem(item.id, 3, first.id, "admin-a");

    expect(restored).toMatchObject({ title: draft.title, subcategoryId: null });
  });

  it("refuses a version that belongs to another item", async () => {
    const item = await repo.createItem(draft, "admin-a");
    const other = await repo.createItem(
      { ...draft, title: "Other" },
      "admin-a",
    );
    const [foreign] = revisionsOf(other.id);

    await expect(
      repo.restoreItem(item.id, 1, foreign.id, "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe("PlanningRepository.setAssignees", () => {
  it("adds the new admins and removes the ones left out", async () => {
    const item = await repo.createItem(draft, "admin-a", {
      assigneeIds: ["admin-a", "admin-b"],
    });

    await repo.setAssignees(item.id, ["admin-b", "admin-c"], "admin-c");

    expect(state.assignees).toEqual([
      { itemId: item.id, discordId: "admin-b", assignedBy: "admin-a" },
      { itemId: item.id, discordId: "admin-c", assignedBy: "admin-c" },
    ]);
  });

  it("refuses someone who is not an admin", async () => {
    const item = await repo.createItem(draft, "admin-a", {
      assigneeIds: ["admin-a"],
    });

    await expect(
      repo.setAssignees(item.id, ["admin-a", "player-x"], "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(state.assignees).toHaveLength(1);
  });
});

describe("PlanningRepository.deleteSubcategory", () => {
  it("clears the subcategory from its items as a revision by the deleting admin", async () => {
    const filed = await repo.createItem(draft, "admin-a");
    const other = await repo.createItem(
      { ...draft, subcategoryId: null },
      "admin-a",
    );

    await repo.deleteSubcategory(ECONOMY, "admin-b");

    expect(state.subcategories.has(ECONOMY)).toBe(false);
    expect(state.items.get(filed.id)).toMatchObject({
      subcategoryId: null,
      revision: 2,
      updatedBy: "admin-b",
    });
    expect(revisionsOf(filed.id)[1]).toMatchObject({
      subcategoryId: null,
      revision: 2,
      editedBy: "admin-b",
    });
    expect(revisionsOf(other.id)).toHaveLength(1);
  });

  it("makes a save that started before the deletion conflict", async () => {
    const item = await repo.createItem(draft, "admin-a");

    await repo.deleteSubcategory(ECONOMY, "admin-b");

    await expect(
      repo.updateItem(item.id, 1, { title: "Edited meanwhile" }, "admin-a"),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
