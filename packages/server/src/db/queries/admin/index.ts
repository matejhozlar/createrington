import type { Pool, PoolClient } from "pg";
import { AdminBaseQueries } from "@/generated/db/admin.queries";

export class AdminQueries extends AdminBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
