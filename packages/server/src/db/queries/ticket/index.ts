import type { Pool, PoolClient } from "pg";
import { TicketBaseQueries } from "@/generated/db/ticket.queries";

/**
 * Custom queries for ticket table
 *
 * - Overview statistics (open/closed counts, avg resolution time)
 * - Volume analytics grouped by time period
 * - Ticket number management (getNext/getCurrent)
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

    const result = await this.runQuery<{
      total: number;
      open: number;
      closed: number;
      avg_resolution_seconds: number;
    }>("get ticket overview", query);
    const row = result.rows[0];
    return {
      total: row.total,
      open: row.open,
      closed: row.closed,
      avgResolutionSeconds: row.avg_resolution_seconds,
    };
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

    const result = await this.runQuery<{
      period: string;
      opened: number;
      closed: number;
    }>("get ticket volume by period", query, [start, end, granularity]);
    return result.rows;
  }

  /**
   * Gets the next ticket number by reading MAX(ticket_number) + 1
   *
   * @returns Promise resolving to the next ticket number
   */
  async getNext(): Promise<number> {
    const query = `SELECT COALESCE(MAX(ticket_number), 0) + 1 AS ticket_number FROM ${this.table}`;

    const result = await this.runQuery<{ ticket_number: string }>(
      "get next ticket number",
      query,
    );
    return parseInt(result.rows[0].ticket_number, 10);
  }

  /**
   * Gets the current highest ticket number
   *
   * @returns Promise resolving to the current ticket number (0 if no tickets exist)
   */
  async getCurrent(): Promise<number> {
    const query = `SELECT COALESCE(MAX(ticket_number), 0) AS ticket_number FROM ${this.table}`;

    const result = await this.runQuery<{ ticket_number: string }>(
      "get current ticket number",
      query,
    );
    return parseInt(result.rows[0].ticket_number, 10);
  }
}
