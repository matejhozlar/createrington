import type { Pool, PoolClient } from "pg";
import { PlanningItemRevisionBaseQueries } from "@/generated/db/planning_item_revision.queries";
import {
  type PlanningFilingRow,
  type PlanningItemFiling,
  filingQuery,
  toFilings,
} from "@/db/queries/planning/item/filing";

export class PlanningItemRevisionQueries extends PlanningItemRevisionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * The categories and subcategories each given revision recorded,
   * categories in declaration order and subcategory ids ascending.
   */
  async getFilings(
    revisionIds: number[],
  ): Promise<Map<number, PlanningItemFiling>> {
    if (revisionIds.length === 0) return new Map();
    const result = await this.runQuery<PlanningFilingRow>(
      "get planning revision filings",
      filingQuery({
        category: "planning_item_revision_category",
        subcategory: "planning_item_revision_subcategory",
        ownerColumn: "revision_id",
      }),
      [revisionIds],
    );
    return toFilings(result.rows);
  }
}
