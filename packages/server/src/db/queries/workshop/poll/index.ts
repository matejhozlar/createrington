import type { Pool, PoolClient } from "pg";
import { WorkshopPollBaseQueries } from "@/generated/db/workshop_poll.queries";

export class WorkshopPollQueries extends WorkshopPollBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
