import type { Pool, PoolClient } from "pg";
import { PlayerBalanceTransactionBaseQueries } from "@/generated/db/player_balance_transaction.queries";
import type { Granularity } from "@/db/utils";

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
    granularity: Granularity = "day",
  ): Promise<
    Array<{
      period: string;
      transactionCount: number;
      totalCredits: number;
      totalDebits: number;
    }>
  > {
    return this.aggregateByPeriod<{
      transaction_count: number;
      total_credits: number;
      total_debits: number;
    }>(
      "get transaction volume by period",
      "createdAt",
      {
        transaction_count: "COUNT(*)::int",
        total_credits:
          "COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::float8",
        total_debits:
          "COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0), 0)::float8",
      },
      start,
      end,
      granularity,
    );
  }
}
