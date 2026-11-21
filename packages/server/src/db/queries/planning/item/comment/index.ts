import type { Pool, PoolClient } from "pg";
import { PlanningItemCommentBaseQueries } from "@/generated/db/planning_item_comment.queries";

export class PlanningItemCommentQueries extends PlanningItemCommentBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
