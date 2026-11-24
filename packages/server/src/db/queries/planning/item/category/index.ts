import type { Pool, PoolClient } from "pg";
import { PlanningItemCategoryBaseQueries } from "@/generated/db/planning_item_category.queries";

export class PlanningItemCategoryQueries extends PlanningItemCategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
