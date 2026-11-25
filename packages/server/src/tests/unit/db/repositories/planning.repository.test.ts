import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestError, ConflictError } from "@/errors";
import type { PlanningItemContent } from "@/db/repositories/planning";
import {
  PLANNING_CATEGORIES,
  type PlanningCategory,
} from "@createrington/shared/planning";

type Fields = Pick<PlanningItemContent, "title" | "body" | "status">;

interface ItemRow extends Fields {
  id: number;
  revision: number;
  sourceUrl: string | null;
  createdBy: string;
  updatedBy: string;
}

interface RevisionRow extends Fields {
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

interface Filed {
  ownerId: number;
  category?: PlanningCategory;
  subcategoryId?: number;
}

const state = vi.hoisted(() => ({
  items: new Map<number, ItemRow>(),
  revisions: [] as RevisionRow[],
  itemFiling: [] as Filed[],
  revisionFiling: [] as Filed[],
  assignees: [] as AssigneeRow[],
  subcategories: new Map<number, { id: number; category: string }>(),
  admins: new Set<string>(),
  nextId: 1,
}));

function filingsOf(rows: Filed[], ids: number[]) {
  const order = (category: PlanningCategory) =>
    PLANNING_CATEGORIES.indexOf(category);
  return new Map(
    ids.map((id) => {
      const own = rows.filter((row) => row.ownerId === id);
      return [
        id,
        {
          categories: own
            .flatMap((row) => row.category ?? [])
            .sort((a, b) => order(a) - order(b)),
          subcategoryIds: own
            .flatMap((row) => row.subcategoryId ?? [])
            .sort((a, b) => a - b),
        },
      ];
    }),
  );
}

vi.mock("@/db/pool", () => {
  const filingTable = (
    rows: () => Filed[],
    set: (next: Filed[]) => void,
    key: "itemId" | "revisionId",
    field: "category" | "subcategoryId",
  ) => ({
    createMany: async (created: Record<string, unknown>[]) => {
      set([
        ...rows(),
        ...created.map((row) => ({
          ownerId: row[key] as number,
          [field]: row[field],
        })),
      ]);
    },
    deleteAll: async (filters: Record<string, number>) => {
      set(
        rows().filter(
          (row) => row.ownerId !== filters[key] || row[field] === undefined,
        ),
      );
    },
    findAll: async ({ subcategoryId }: { subcategoryId: number }) =>
      rows()
        .filter((row) => row.subcategoryId === subcategoryId)
        .map((row) => ({ [key]: row.ownerId, subcategoryId })),
  });

  const tx = {
    admin: {
      findAll: async (filters: { discordId: { $in: string[] } }) =>
        filters.discordId.$in
          .filter((discordId) => state.admins.has(discordId))
          .map((discordId) => ({ discordId })),
    },
    planning: {
      subcategory: {
        findAll: async ({ id }: { id: { $in: number[] } }) =>
          id.$in.flatMap((subId) => state.subcategories.get(subId) ?? []),
        delete: async ({ id }: { id: number }) => {
          state.subcategories.delete(id);
        },
      },
      item: {
        getFilings: async (ids: number[]) => filingsOf(state.itemFiling, ids),
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
        category: filingTable(
          () => state.itemFiling,
          (next) => (state.itemFiling = next),
          "itemId",
          "category",
        ),
        subcategory: filingTable(
          () => state.itemFiling,
          (next) => (state.itemFiling = next),
          "itemId",
          "subcategoryId",
        ),
        revision: {
          createAndReturn: async (data: Omit<RevisionRow, "id">) => {
            const revision = { ...data, id: state.nextId++ };
            state.revisions.push(revision);
            return { ...revision };
          },
          find: async ({ id }: { id: number }) =>
            state.revisions.find((revision) => revision.id === id) ?? null,
          getFilings: async (ids: number[]) =>
            filingsOf(state.revisionFiling, ids),
          category: filingTable(
            () => state.revisionFiling,
            (next) => (state.revisionFiling = next),
            "revisionId",
            "category",
          ),
          subcategory: filingTable(
            () => state.revisionFiling,
            (next) => (state.revisionFiling = next),
            "revisionId",
            "subcategoryId",
          ),
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
const QUESTS = 11;
const LAUNCHER = 20;

const draft: PlanningItemContent = {
  title: "Give money a purpose",
  body: "Nothing worth buying right now",
  categories: ["modpack"],
  subcategoryIds: [ECONOMY],
  status: "draft",
};

const repo = new PlanningRepository();

function revisionsOf(itemId: number) {
  const revisions = state.revisions.filter(
    (revision) => revision.itemId === itemId,
  );
  const filings = filingsOf(
    state.revisionFiling,
    revisions.map((revision) => revision.id),
  );
  return revisions.map((revision) => ({
    ...revision,
    ...filings.get(revision.id),
  }));
}

function filingOf(itemId: number) {
  return filingsOf(state.itemFiling, [itemId]).get(itemId);
}

beforeEach(() => {
  state.items.clear();
  state.revisions = [];
  state.itemFiling = [];
  state.revisionFiling = [];
  state.assignees = [];
  state.subcategories = new Map([
    [ECONOMY, { id: ECONOMY, category: "modpack" }],
    [QUESTS, { id: QUESTS, category: "modpack" }],
    [LAUNCHER, { id: LAUNCHER, category: "website" }],
  ]);
  state.admins = new Set(["admin-a", "admin-b", "admin-c"]);
  state.nextId = 1;
});

describe("PlanningRepository.createItem", () => {
  it("stores the first revision with the item's content", async () => {
    const item = await repo.createItem(draft, "admin-a");

    expect(item.revision).toBe(1);
    expect(filingOf(item.id)).toEqual({
      categories: ["modpack"],
      subcategoryIds: [ECONOMY],
    });
    expect(revisionsOf(item.id)).toEqual([
      expect.objectContaining({ ...draft, revision: 1, editedBy: "admin-a" }),
    ]);
  });

  it("files an item under several categories and subcategories", async () => {
    const item = await repo.createItem(
      {
        ...draft,
        categories: ["website", "modpack", "website"],
        subcategoryIds: [LAUNCHER, QUESTS, ECONOMY],
      },
      "admin-a",
    );

    expect(filingOf(item.id)).toEqual({
      categories: ["modpack", "website"],
      subcategoryIds: [ECONOMY, QUESTS, LAUNCHER],
    });
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

  it("refuses a subcategory outside the item's categories", async () => {
    await expect(
      repo.createItem({ ...draft, subcategoryIds: [LAUNCHER] }, "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(state.items.size).toBe(0);
  });

  it("refuses an item without a category", async () => {
    await expect(
      repo.createItem(
        { ...draft, categories: [], subcategoryIds: [] },
        "admin-a",
      ),
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
      { status: "approved", body: "Shops sell claim upgrades" },
      "admin-b",
    );

    expect(updated).toMatchObject({ revision: 2, updatedBy: "admin-b" });
    expect(revisionsOf(item.id)[1]).toMatchObject({
      ...draft,
      status: "approved",
      body: "Shops sell claim upgrades",
      revision: 2,
      editedBy: "admin-b",
    });
  });

  it("records a category change as a revision", async () => {
    const item = await repo.createItem(draft, "admin-a");

    await repo.updateItem(
      item.id,
      1,
      {
        categories: ["modpack", "website"],
        subcategoryIds: [ECONOMY, LAUNCHER],
      },
      "admin-b",
    );

    expect(filingOf(item.id)).toEqual({
      categories: ["modpack", "website"],
      subcategoryIds: [ECONOMY, LAUNCHER],
    });
    expect(revisionsOf(item.id).map((revision) => revision.categories)).toEqual(
      [["modpack"], ["modpack", "website"]],
    );
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
      { title: draft.title, body: undefined, categories: ["modpack"] },
      "admin-b",
    );

    expect(result).toMatchObject({ revision: 1, updatedBy: "admin-a" });
    expect(revisionsOf(item.id)).toHaveLength(1);
  });

  it("drops the subcategories of a category the item leaves", async () => {
    const item = await repo.createItem(
      {
        ...draft,
        categories: ["modpack", "website"],
        subcategoryIds: [ECONOMY, LAUNCHER],
      },
      "admin-a",
    );

    await repo.updateItem(item.id, 1, { categories: ["website"] }, "admin-a");

    expect(filingOf(item.id)).toEqual({
      categories: ["website"],
      subcategoryIds: [LAUNCHER],
    });
  });

  it("refuses an explicitly chosen subcategory outside the item's categories", async () => {
    const item = await repo.createItem(draft, "admin-a");

    await expect(
      repo.updateItem(item.id, 1, { subcategoryIds: [LAUNCHER] }, "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it("refuses removing the last category", async () => {
    const item = await repo.createItem(draft, "admin-a");

    await expect(
      repo.updateItem(item.id, 1, { categories: [] }, "admin-a"),
    ).rejects.toBeInstanceOf(BadRequestError);
    expect(filingOf(item.id)?.categories).toEqual(["modpack"]);
  });
});

describe("PlanningRepository.restoreItem", () => {
  it("brings back old content as a new revision and keeps the history", async () => {
    const item = await repo.createItem(draft, "admin-a");
    await repo.updateItem(
      item.id,
      1,
      { title: "Rewritten", categories: ["website"] },
      "admin-b",
    );
    const [first] = revisionsOf(item.id);

    const restored = await repo.restoreItem(item.id, 2, first.id, "admin-c");

    expect(restored).toMatchObject({
      title: draft.title,
      revision: 3,
      updatedBy: "admin-c",
    });
    expect(filingOf(item.id)).toEqual({
      categories: ["modpack"],
      subcategoryIds: [ECONOMY],
    });
    expect(revisionsOf(item.id).map((revision) => revision.title)).toEqual([
      draft.title,
      "Rewritten",
      draft.title,
    ]);
  });

  it("drops a subcategory that was deleted since that version", async () => {
    const item = await repo.createItem(
      { ...draft, subcategoryIds: [ECONOMY, QUESTS] },
      "admin-a",
    );
    const [first] = revisionsOf(item.id);
    await repo.updateItem(item.id, 1, { title: "Renamed" }, "admin-a");
    state.subcategories.delete(ECONOMY);

    await repo.restoreItem(item.id, 2, first.id, "admin-a");

    expect(filingOf(item.id)?.subcategoryIds).toEqual([QUESTS]);
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
  it("removes the subcategory from its items as a revision by the deleting admin", async () => {
    const filed = await repo.createItem(
      { ...draft, subcategoryIds: [ECONOMY, QUESTS] },
      "admin-a",
    );
    const other = await repo.createItem(
      { ...draft, subcategoryIds: [QUESTS] },
      "admin-a",
    );

    await repo.deleteSubcategory(ECONOMY, "admin-b");

    expect(state.subcategories.has(ECONOMY)).toBe(false);
    expect(filingOf(filed.id)?.subcategoryIds).toEqual([QUESTS]);
    expect(state.items.get(filed.id)).toMatchObject({
      revision: 2,
      updatedBy: "admin-b",
    });
    expect(revisionsOf(filed.id)[1]).toMatchObject({
      subcategoryIds: [QUESTS],
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
