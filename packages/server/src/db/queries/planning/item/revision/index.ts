import type { Pool, PoolClient } from "pg";
import { PlanningItemRevisionBaseQueries } from "@/generated/db/planning_item_revision.queries";

export class PlanningItemRevisionQueries extends PlanningItemRevisionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
