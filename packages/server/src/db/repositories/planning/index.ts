import { db } from "@/db/pool";
import type { DatabaseQueries, PlanningItem } from "@/generated/db";
import { BadRequestError, ConflictError } from "@/errors";
import type { PlanningItemFiling } from "@/db/queries/planning/item/filing";
import {
  PLANNING_CATEGORIES,
  type PlanningCategory,
  type PlanningItemStatus,
} from "@createrington/shared/planning";

export interface PlanningItemContent {
  title: string;
  body: string | null;
  categories: PlanningCategory[];
  subcategoryIds: number[];
  status: PlanningItemStatus;
}

function contentOf(
  source: Pick<PlanningItem, "title" | "body" | "status">,
  filing: PlanningItemFiling | undefined,
): PlanningItemContent {
  return {
    title: source.title,
    body: source.body,
    status: source.status,
    categories: filing?.categories ?? [],
    subcategoryIds: filing?.subcategoryIds ?? [],
  };
}

function normalized(content: PlanningItemContent): PlanningItemContent {
  return {
    ...content,
    categories: PLANNING_CATEGORIES.filter((category) =>
      content.categories.includes(category),
    ),
    subcategoryIds: [...new Set(content.subcategoryIds)].sort((a, b) => a - b),
  };
}

function sameList<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameContent(a: PlanningItemContent, b: PlanningItemContent): boolean {
  return (
    a.title === b.title &&
    a.body === b.body &&
    a.status === b.status &&
    sameList(a.categories, b.categories) &&
    sameList(a.subcategoryIds, b.subcategoryIds)
  );
}

function merge(
  current: PlanningItemContent,
  patch: Partial<PlanningItemContent>,
): PlanningItemContent {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<PlanningItemContent>;
  return { ...current, ...defined };
}

/**
 * Planning item saves. Every change to an item's content (title, body,
 * status, categories and subcategories) goes through here so the item, its
 * category rows and its planning_item_revision copy are written in one
 * transaction, under a row lock, and a save based on a stale revision is
 * refused instead of overwriting someone else's edit.
 */
export class PlanningRepository {
  /**
   * Create an item with its first revision and, optionally, its assignees
   * and the Discord message it was captured from. Every subcategory must
   * belong to one of the item's categories.
   */
  async createItem(
    content: PlanningItemContent,
    actor: string,
    extra: { assigneeIds?: string[]; sourceUrl?: string | null } = {},
  ): Promise<PlanningItem> {
    return db.inTransaction(async (tx) => {
      const next = await this.checked(tx, content, "strict");
      const created = await tx.planning.item.createAndReturn({
        title: next.title,
        body: next.body,
        status: next.status,
        revision: 1,
        sourceUrl: extra.sourceUrl ?? null,
        createdBy: actor,
        updatedBy: actor,
      });
      await this.writeFiling(tx, created.id, next);
      await this.writeRevision(tx, created.id, 1, next, actor);
      await this.replaceAssignees(
        tx,
        created.id,
        extra.assigneeIds ?? [],
        actor,
      );

      return created;
    });
  }

  /**
   * Apply a patch as a new revision. Throws ConflictError when
   * `expectedRevision` is no longer the latest; returns the item untouched
   * when the patch changes nothing. Subcategories left without their
   * category by the patch are dropped.
   */
  async updateItem(
    id: number,
    expectedRevision: number,
    patch: Partial<PlanningItemContent>,
    actor: string,
  ): Promise<PlanningItem> {
    return db.inTransaction(async (tx) => {
      const current = await this.lockAtRevision(tx, id, expectedRevision);
      const stored = await this.storedContent(tx, current);
      const next = await this.checked(
        tx,
        merge(stored, patch),
        patch.subcategoryIds === undefined ? "drop" : "strict",
      );

      return this.save(tx, current, stored, next, actor);
    });
  }

  /**
   * Write an earlier revision's content back as a new revision, so the
   * history only ever grows. Subcategories that no longer exist are dropped.
   */
  async restoreItem(
    id: number,
    expectedRevision: number,
    revisionId: number,
    actor: string,
  ): Promise<PlanningItem> {
    return db.inTransaction(async (tx) => {
      const current = await this.lockAtRevision(tx, id, expectedRevision);
      const source = await tx.planning.item.revision.find({ id: revisionId });
      if (!source || source.itemId !== id) {
        throw new BadRequestError("That version does not belong to this plan");
      }

      const filings = await tx.planning.item.revision.getFilings([source.id]);
      const next = await this.checked(
        tx,
        contentOf(source, filings.get(source.id)),
        "drop",
      );
      const stored = await this.storedContent(tx, current);

      return this.save(tx, current, stored, next, actor);
    });
  }

  /** Replace an item's assignees; every id must be a current admin. */
  async setAssignees(
    itemId: number,
    discordIds: string[],
    actor: string,
  ): Promise<void> {
    await db.inTransaction(async (tx) => {
      await tx.planning.item.getForUpdate(itemId);
      await this.replaceAssignees(tx, itemId, discordIds, actor);
    });
  }

  /**
   * Delete a subcategory. Each item filed under it first loses it as a new
   * revision, so the item's history records who removed it and its revision
   * number moves on for anyone editing it.
   */
  async deleteSubcategory(id: number, actor: string): Promise<void> {
    await db.inTransaction(async (tx) => {
      const filed = await tx.planning.item.subcategory.findAll(
        { subcategoryId: id },
        { orderBy: "itemId", orderDirection: "asc" },
      );
      for (const { itemId } of filed) {
        const current = await tx.planning.item.getForUpdate(itemId);
        const stored = await this.storedContent(tx, current);
        if (!stored.subcategoryIds.includes(id)) continue;
        await this.save(
          tx,
          current,
          stored,
          {
            ...stored,
            subcategoryIds: stored.subcategoryIds.filter((sub) => sub !== id),
          },
          actor,
        );
      }
      await tx.planning.subcategory.delete({ id });
    });
  }

  private async lockAtRevision(
    tx: DatabaseQueries,
    id: number,
    expectedRevision: number,
  ): Promise<PlanningItem> {
    const current = await tx.planning.item.getForUpdate(id);
    if (current.revision !== expectedRevision) {
      throw new ConflictError(
        "This plan was changed by someone else. Reload it and try again.",
      );
    }
    return current;
  }

  private async storedContent(
    tx: DatabaseQueries,
    item: PlanningItem,
  ): Promise<PlanningItemContent> {
    const filings = await tx.planning.item.getFilings([item.id]);
    return contentOf(item, filings.get(item.id));
  }

  private async checked(
    tx: DatabaseQueries,
    content: PlanningItemContent,
    misfits: "strict" | "drop",
  ): Promise<PlanningItemContent> {
    const next = normalized(content);
    if (next.categories.length === 0) {
      throw new BadRequestError("A plan needs at least one category");
    }
    if (next.subcategoryIds.length === 0) return next;

    const found = await tx.planning.subcategory.findAll({
      id: { $in: next.subcategoryIds },
    });
    const fitting = new Set(
      found
        .filter((subcategory) => next.categories.includes(subcategory.category))
        .map((subcategory) => subcategory.id),
    );
    if (misfits === "strict" && fitting.size !== next.subcategoryIds.length) {
      throw new BadRequestError(
        "Every subcategory must belong to one of the plan's categories",
      );
    }
    return {
      ...next,
      subcategoryIds: next.subcategoryIds.filter((sub) => fitting.has(sub)),
    };
  }

  private async save(
    tx: DatabaseQueries,
    current: PlanningItem,
    stored: PlanningItemContent,
    next: PlanningItemContent,
    actor: string,
  ): Promise<PlanningItem> {
    if (sameContent(stored, next)) return current;

    const revision = current.revision + 1;
    const updated = await tx.planning.item.updateAndReturn(
      { id: current.id },
      {
        title: next.title,
        body: next.body,
        status: next.status,
        revision,
        updatedBy: actor,
      },
    );
    await tx.planning.item.category.deleteAll({ itemId: current.id });
    await tx.planning.item.subcategory.deleteAll({ itemId: current.id });
    await this.writeFiling(tx, current.id, next);
    await this.writeRevision(tx, current.id, revision, next, actor);

    return updated;
  }

  private async writeFiling(
    tx: DatabaseQueries,
    itemId: number,
    content: PlanningItemContent,
  ): Promise<void> {
    await tx.planning.item.category.createMany(
      content.categories.map((category) => ({ itemId, category })),
    );
    await tx.planning.item.subcategory.createMany(
      content.subcategoryIds.map((subcategoryId) => ({
        itemId,
        subcategoryId,
      })),
    );
  }

  private async writeRevision(
    tx: DatabaseQueries,
    itemId: number,
    revision: number,
    content: PlanningItemContent,
    actor: string,
  ): Promise<void> {
    const created = await tx.planning.item.revision.createAndReturn({
      itemId,
      revision,
      title: content.title,
      body: content.body,
      status: content.status,
      editedBy: actor,
    });
    await tx.planning.item.revision.category.createMany(
      content.categories.map((category) => ({
        revisionId: created.id,
        category,
      })),
    );
    await tx.planning.item.revision.subcategory.createMany(
      content.subcategoryIds.map((subcategoryId) => ({
        revisionId: created.id,
        subcategoryId,
      })),
    );
  }

  private async replaceAssignees(
    tx: DatabaseQueries,
    itemId: number,
    discordIds: string[],
    actor: string,
  ): Promise<void> {
    const wanted = [...new Set(discordIds)];
    if (wanted.length > 0) {
      const admins = await tx.admin.findAll({ discordId: { $in: wanted } });
      if (admins.length !== wanted.length) {
        throw new BadRequestError("Only admins can be assigned");
      }
    }

    const existing = await tx.planning.item.assignee.findAll({ itemId });
    const existingIds = new Set(existing.map((row) => row.discordId));
    const removed = existing
      .map((row) => row.discordId)
      .filter((discordId) => !wanted.includes(discordId));
    const added = wanted.filter((discordId) => !existingIds.has(discordId));

    if (removed.length > 0) {
      await tx.planning.item.assignee.deleteAll({
        itemId,
        discordId: { $in: removed },
      });
    }
    if (added.length > 0) {
      await tx.planning.item.assignee.createMany(
        added.map((discordId) => ({ itemId, discordId, assignedBy: actor })),
      );
    }
  }
}
