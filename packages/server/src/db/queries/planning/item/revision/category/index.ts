import type { Pool, PoolClient } from "pg";
import { PlanningItemRevisionCategoryBaseQueries } from "@/generated/db/planning_item_revision_category.queries";

export class PlanningItemRevisionCategoryQueries extends PlanningItemRevisionCategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
