import type { Pool, PoolClient } from "pg";
import { TicketBaseQueries } from "@/generated/db/ticket.queries";

/**
 * Custom queries for ticket table
 *
 * Extends the auto-generated base class with custom methods
 */
export class TicketQueries extends TicketBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  // Custom methods can be implemented here

  /**
   * Gets the next ticket number from the sequence
   * This is transaction-safe and guarantees unique sequential numbers
   *
   * @returns Promise resolving to the next ticket number
   */
  async getNext(): Promise<number> {
    const query = "SELECT nextval('ticket_number_seq') as ticket_number";

    try {
      const result = await this.db.query<{ ticket_number: string }>(query);
      return parseInt(result.rows[0].ticket_number, 10);
    } catch (error) {
      logger.error("Failed to get next ticket number:", error);
      throw error;
    }
  }

  /**
   * Gets the current ticket number without incrementing the sequence
   * Useful for displaying the current ticket count
   *
   * @returns Promise resolving to the current ticket number
   */
  async getCurrent(): Promise<number> {
    const query = "SELECT last_value as ticket_number FROM ticket_number_seq";

    try {
      const result = await this.db.query<{ ticket_number: string }>(query);
      return parseInt(result.rows[0].ticket_number, 10);
    } catch (error) {
      logger.error("Failed to get current ticket number:", error);
      throw error;
    }
  }
}
