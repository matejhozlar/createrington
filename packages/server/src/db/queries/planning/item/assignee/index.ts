import type { Pool, PoolClient } from "pg";
import { PlanningItemAssigneeBaseQueries } from "@/generated/db/planning_item_assignee.queries";

export class PlanningItemAssigneeQueries extends PlanningItemAssigneeBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
