import type { Pool, PoolClient } from "pg";
import { PlayerBalanceTransactionBaseQueries } from "@/generated/db/player_balance_transaction.queries";

/**
 * Custom queries for player_balance_transaction table
 *
 * - Time-series volume analytics (credits vs debits per period)
 * - Per-player lifetime earnings aggregation
 */
export class PlayerBalanceTransactionQueries extends PlayerBalanceTransactionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Get transaction volume grouped by time period
   *
   * Aggregates transactions into buckets using DATE_TRUNC, splitting
   * positive amounts (credits) and negative amounts (debits).
   *
   * @param start - Start of the date range (inclusive)
   * @param end - End of the date range (exclusive)
   * @param granularity - Bucketing interval: "day", "week", or "month"
   * @returns Array of periods with transaction count, total credits, and total debits
   */
  async getVolumeByPeriod(
    start: Date,
    end: Date,
    granularity: "day" | "week" | "month" = "day",
  ): Promise<
    Array<{
      period: string;
      transactionCount: number;
      totalCredits: number;
      totalDebits: number;
    }>
  > {
    const query = `
      SELECT
        DATE_TRUNC($3, created_at)::text AS period,
        COUNT(*)::integer AS transaction_count,
        COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS total_credits,
        COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0) AS total_debits
      FROM ${this.table}
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY 1
      ORDER BY 1`;

    const result = await this.runQuery<{
      period: string;
      transaction_count: number;
      total_credits: bigint;
      total_debits: bigint;
    }>("get transaction volume by period", query, [start, end, granularity]);

    return result.rows.map((row) => ({
      period: row.period,
      transactionCount: row.transaction_count,
      totalCredits: Number(row.total_credits),
      totalDebits: Number(row.total_debits),
    }));
  }
}
