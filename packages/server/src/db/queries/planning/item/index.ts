import type { Pool, PoolClient } from "pg";
import { PlanningItemBaseQueries } from "@/generated/db/planning_item.queries";
import type {
  PlanningItem,
  PlanningItemRow,
} from "@createrington/shared/db/planning_item.types";
import { createNotFoundError, escapeLike } from "@/db/utils/query-helpers";
import type {
  PlanningCategory,
  PlanningItemStatus,
} from "@createrington/shared/planning";

export const PLANNING_UNASSIGNED = "unassigned";

const ORDER_COLUMNS = {
  updatedAt: "pi.updated_at",
  createdAt: "pi.created_at",
  title: "LOWER(pi.title)",
} as const;

export interface PlanningItemPageParams {
  status?: PlanningItemStatus;
  category?: PlanningCategory;
  subcategoryId?: number;
  /** A Discord id, or PLANNING_UNASSIGNED for items nobody is assigned to. */
  assignee?: string;
  /** Matched against the title and the body, case-insensitively. */
  search?: string;
  orderBy: keyof typeof ORDER_COLUMNS;
  orderDirection: "asc" | "desc";
  limit: number;
  offset: number;
}

export class PlanningItemQueries extends PlanningItemBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * One page of the items matching every given filter, with the total match
   * count and how many items each status holds under the other filters.
   */
  async listPage(params: PlanningItemPageParams): Promise<{
    rows: PlanningItem[];
    total: number;
    statusCounts: Record<PlanningItemStatus, number>;
  }> {
    const values: unknown[] = [];
    const bind = (value: unknown): string => `$${values.push(value)}`;
    const where = ["TRUE"];

    if (params.category) where.push(`pi.category = ${bind(params.category)}`);
    if (params.subcategoryId !== undefined) {
      where.push(`pi.subcategory_id = ${bind(params.subcategoryId)}`);
    }
    if (params.assignee === PLANNING_UNASSIGNED) {
      where.push(
        "NOT EXISTS (SELECT 1 FROM planning_item_assignee a WHERE a.item_id = pi.id)",
      );
    } else if (params.assignee) {
      where.push(
        `EXISTS (SELECT 1 FROM planning_item_assignee a WHERE a.item_id = pi.id AND a.discord_id = ${bind(params.assignee)})`,
      );
    }
    if (params.search) {
      const needle = bind(escapeLike(params.search));
      where.push(
        `(pi.title ILIKE '%' || ${needle} || '%' OR pi.body ILIKE '%' || ${needle} || '%')`,
      );
    }

    const anyStatus = `FROM ${this.table} pi WHERE ${where.join(" AND ")}`;
    const anyStatusValues = [...values];

    if (params.status) where.push(`pi.status = ${bind(params.status)}`);
    const matching = `FROM ${this.table} pi WHERE ${where.join(" AND ")}`;
    const matchingValues = [...values];

    const direction = params.orderDirection === "asc" ? "ASC" : "DESC";
    const limit = bind(params.limit);
    const offset = bind(params.offset);

    const [listResult, countResult, statusResult] = await Promise.all([
      this.runQuery<PlanningItemRow>(
        "list planning items",
        `SELECT pi.* ${matching}
         ORDER BY ${ORDER_COLUMNS[params.orderBy]} ${direction}, pi.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        values,
      ),
      this.runQuery<{ total: number }>(
        "count planning items",
        `SELECT COUNT(*)::int AS total ${matching}`,
        matchingValues,
      ),
      this.runQuery<{ status: PlanningItemStatus; total: number }>(
        "count planning items by status",
        `SELECT pi.status, COUNT(*)::int AS total ${anyStatus} GROUP BY pi.status`,
        anyStatusValues,
      ),
    ]);

    const statusCounts = { draft: 0, open: 0, approved: 0 };
    for (const row of statusResult.rows) statusCounts[row.status] = row.total;

    return {
      rows: this.mapRowsToEntities(listResult.rows),
      total: countResult.rows[0]?.total ?? 0,
      statusCounts,
    };
  }

  /**
   * Reads an item under a row lock (SELECT ... FOR UPDATE). Must be called on
   * a transaction-bound instance, so two saves of the same item run one after
   * the other and the second one sees the first one's revision number.
   *
   * @throws NotFoundError when the id does not exist
   */
  async getForUpdate(id: number): Promise<PlanningItem> {
    const query = `
      SELECT *
      FROM ${this.table}
      WHERE id = $1
      FOR UPDATE`;

    const result = await this.runQuery<PlanningItemRow>(
      "get planning item for update",
      query,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw createNotFoundError(this.table, { id });
    }
    return this.mapRowToEntity(row);
  }
}
