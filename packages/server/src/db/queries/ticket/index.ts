import type { Pool, PoolClient } from "pg";
import { TicketBaseQueries } from "@/generated/db/ticket.queries";

/**
 * Custom queries for ticket table
 *
 * - Overview statistics (open/closed counts, avg resolution time)
 * - Volume analytics grouped by time period
 * - Ticket number sequence management (getNext/getCurrent)
 */
export class TicketQueries extends TicketBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get ticket overview statistics
   *
   * Returns aggregate counts by status and the average time
   * between ticket creation and closure (resolution time).
   *
   * @returns Total, open, and closed counts plus average resolution in seconds
   */
  async getOverview(): Promise<{
    total: number;
    open: number;
    closed: number;
    avgResolutionSeconds: number;
  }> {
    const query = `
      SELECT
        COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE status = 'open')::integer AS open,
        COUNT(*) FILTER (WHERE status = 'closed')::integer AS closed,
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (closed_at - created_at))) FILTER (WHERE closed_at IS NOT NULL),
          0
        )::float AS avg_resolution_seconds
      FROM ${this.table}`;

    try {
      const result = await this.db.query<{
        total: number;
        open: number;
        closed: number;
        avg_resolution_seconds: number;
      }>(query);
      const row = result.rows[0];
      return {
        total: row.total,
        open: row.open,
        closed: row.closed,
        avgResolutionSeconds: row.avg_resolution_seconds,
      };
    } catch (error) {
      logger.error("Failed to get ticket overview:", error);
      throw error;
    }
  }

  /**
   * Get ticket volume grouped by time period
   *
   * Counts tickets opened (by created_at) and closed (by closed_at)
   * per period. Periods are included if they have either opens or closes.
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with opened and closed ticket counts
   */
  async getVolumeByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<Array<{ period: string; opened: number; closed: number }>> {
    const query = `
      SELECT
        period,
        COALESCE(opened, 0)::integer AS opened,
        COALESCE(closed, 0)::integer AS closed
      FROM (
        SELECT DISTINCT period FROM (
          SELECT DATE_TRUNC($3, created_at)::text AS period FROM ${this.table}
            WHERE created_at >= $1 AND created_at < $2
          UNION
          SELECT DATE_TRUNC($3, closed_at)::text AS period FROM ${this.table}
            WHERE closed_at >= $1 AND closed_at < $2
        ) all_periods
      ) p
      LEFT JOIN (
        SELECT DATE_TRUNC($3, created_at)::text AS period, COUNT(*)::integer AS opened
        FROM ${this.table}
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY 1
      ) o USING (period)
      LEFT JOIN (
        SELECT DATE_TRUNC($3, closed_at)::text AS period, COUNT(*)::integer AS closed
        FROM ${this.table}
        WHERE closed_at >= $1 AND closed_at < $2
        GROUP BY 1
      ) c USING (period)
      ORDER BY period`;

    try {
      const result = await this.db.query<{
        period: string;
        opened: number;
        closed: number;
      }>(query, [start, end, granularity]);
      return result.rows;
    } catch (error) {
      logger.error("Failed to get ticket volume by period:", error);
      throw error;
    }
  }

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
