import { db } from "@/db";
import type { DatabaseQueries, PlanningItem } from "@/generated/db";
import { BadRequestError, ConflictError } from "@/errors";
import type {
  PlanningCategory,
  PlanningItemStatus,
} from "@createrington/shared/planning";

export interface PlanningItemContent {
  title: string;
  body: string | null;
  category: PlanningCategory;
  subcategoryId: number | null;
  status: PlanningItemStatus;
  decision: string | null;
}

const CONTENT_FIELDS = [
  "title",
  "body",
  "category",
  "subcategoryId",
  "status",
  "decision",
] as const satisfies readonly (keyof PlanningItemContent)[];

function contentOf(source: PlanningItemContent): PlanningItemContent {
  return {
    title: source.title,
    body: source.body,
    category: source.category,
    subcategoryId: source.subcategoryId,
    status: source.status,
    decision: source.decision,
  };
}

function merge(
  current: PlanningItemContent,
  patch: Partial<PlanningItemContent>,
): PlanningItemContent {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<PlanningItemContent>;
  return { ...contentOf(current), ...defined };
}

/**
 * Planning item saves. Every change to an item's content goes through here so
 * the item row and its planning_item_revision copy are written in one
 * transaction, under a row lock, and a save based on a stale revision is
 * refused instead of overwriting someone else's edit.
 */
export class PlanningRepository {
  /** Create an item with its first revision and, optionally, its assignees. */
  async createItem(
    content: PlanningItemContent,
    actor: string,
    assigneeIds: string[] = [],
  ): Promise<PlanningItem> {
    return db.inTransaction(async (tx) => {
      if (
        content.subcategoryId !== null &&
        !(await this.subcategoryFits(tx, content))
      ) {
        throw new BadRequestError(
          "That subcategory belongs to a different category",
        );
      }

      const created = await tx.planning.item.createAndReturn({
        ...content,
        revision: 1,
        createdBy: actor,
        updatedBy: actor,
      });
      await tx.planning.item.revision.create({
        ...content,
        itemId: created.id,
        revision: 1,
        editedBy: actor,
      });
      await this.replaceAssignees(tx, created.id, assigneeIds, actor);

      return created;
    });
  }

  /**
   * Apply a patch as a new revision. Throws ConflictError when
   * `expectedRevision` is no longer the latest; returns the item untouched
   * when the patch changes nothing. A subcategory left over from a category
   * change is cleared.
   */
  async updateItem(
    id: number,
    expectedRevision: number,
    patch: Partial<PlanningItemContent>,
    actor: string,
  ): Promise<PlanningItem> {
    return db.inTransaction(async (tx) => {
      const current = await this.lockAtRevision(tx, id, expectedRevision);
      const next = merge(current, patch);

      if (
        next.subcategoryId !== null &&
        !(await this.subcategoryFits(tx, next))
      ) {
        if (patch.subcategoryId !== undefined) {
          throw new BadRequestError(
            "That subcategory belongs to a different category",
          );
        }
        next.subcategoryId = null;
      }

      return this.save(tx, current, next, actor);
    });
  }

  /**
   * Write an earlier revision's content back as a new revision, so the
   * history only ever grows. A subcategory that no longer exists is cleared.
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
        throw new BadRequestError("That version does not belong to this card");
      }

      const next = contentOf(source);
      if (
        next.subcategoryId !== null &&
        !(await this.subcategoryFits(tx, next))
      ) {
        next.subcategoryId = null;
      }

      return this.save(tx, current, next, actor);
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

  private async lockAtRevision(
    tx: DatabaseQueries,
    id: number,
    expectedRevision: number,
  ): Promise<PlanningItem> {
    const current = await tx.planning.item.getForUpdate(id);
    if (current.revision !== expectedRevision) {
      throw new ConflictError(
        "This card was changed by someone else. Reload it and try again.",
      );
    }
    return current;
  }

  private async subcategoryFits(
    tx: DatabaseQueries,
    content: PlanningItemContent,
  ): Promise<boolean> {
    if (content.subcategoryId === null) return true;
    const subcategory = await tx.planning.subcategory.find({
      id: content.subcategoryId,
    });
    return subcategory?.category === content.category;
  }

  private async save(
    tx: DatabaseQueries,
    current: PlanningItem,
    next: PlanningItemContent,
    actor: string,
  ): Promise<PlanningItem> {
    if (CONTENT_FIELDS.every((field) => current[field] === next[field])) {
      return current;
    }

    const revision = current.revision + 1;
    const updated = await tx.planning.item.updateAndReturn(
      { id: current.id },
      { ...next, revision, updatedBy: actor },
    );
    await tx.planning.item.revision.create({
      ...next,
      itemId: current.id,
      revision,
      editedBy: actor,
    });

    return updated;
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
