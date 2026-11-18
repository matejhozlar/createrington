import type { Pool, PoolClient } from "pg";
import { WorkshopPollBallotBaseQueries } from "@/generated/db/workshop_poll_ballot.queries";

export class WorkshopPollBallotQueries extends WorkshopPollBallotBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
