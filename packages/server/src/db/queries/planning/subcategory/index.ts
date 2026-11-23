import type { Pool, PoolClient } from "pg";
import { PlanningSubcategoryBaseQueries } from "@/generated/db/planning_subcategory.queries";

export class PlanningSubcategoryQueries extends PlanningSubcategoryBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
