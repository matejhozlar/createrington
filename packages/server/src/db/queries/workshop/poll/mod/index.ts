import type { Pool, PoolClient } from "pg";
import { WorkshopPollModBaseQueries } from "@/generated/db/workshop_poll_mod.queries";

export class WorkshopPollModQueries extends WorkshopPollModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
