import type { Pool, PoolClient } from "pg";
import { TicketActionBaseQueries } from "@/generated/db/ticket_action.queries";

/**
 * Custom queries for ticket_action table
 *
 * Extends the auto-generated base class with custom methods
 */
export class TicketActionQueries extends TicketActionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here
}
