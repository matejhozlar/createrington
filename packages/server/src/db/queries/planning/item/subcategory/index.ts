import type { Pool, PoolClient } from "pg";
import { PlanningItemSubcategoryBaseQueries } from "@/generated/db/planning_item_subcategory.queries";

export class PlanningItemSubcategoryQueries extends PlanningItemSubcategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
