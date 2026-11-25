import type { Pool, PoolClient } from "pg";
import { PlanningItemRevisionSubcategoryBaseQueries } from "@/generated/db/planning_item_revision_subcategory.queries";

export class PlanningItemRevisionSubcategoryQueries extends PlanningItemRevisionSubcategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
