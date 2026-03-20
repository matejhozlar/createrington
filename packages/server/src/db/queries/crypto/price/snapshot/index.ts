import type { Pool, PoolClient } from "pg";
import { CryptoPriceSnapshotBaseQueries } from "@/generated/db/crypto_price_snapshot.queries";
import type { CryptoPriceInterval } from "@createrington/shared/db/database.types";

/**
 * Custom queries for crypto_price_snapshot table
 *
 * Extends the auto-generated base class with custom methods.
 * This file is scaffolded once and never overwritten - add your custom
 * query methods here while inheriting all generated CRUD operations.
 */
export class CryptoPriceSnapshotQueries extends CryptoPriceSnapshotBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  /**
   * Upsert an OHLCV snapshot with correct merge semantics:
   * - openPrice preserved from first insert
   * - highPrice = GREATEST(existing, new)
   * - lowPrice  = LEAST(existing, new)
   * - closePrice replaced with latest value
   * - volume    accumulated (summed)
   */
  async upsertOhlcv(data: {
    tokenId: number;
    interval: CryptoPriceInterval;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    closePrice: string;
    volume: bigint;
    recordedAt: Date;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO ${this.table}
         (token_id, interval, open_price, high_price, low_price, close_price, volume, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (token_id, interval, recorded_at)
       DO UPDATE SET
         close_price = EXCLUDED.close_price,
         high_price  = GREATEST(${this.table}.high_price, EXCLUDED.high_price),
         low_price   = LEAST(${this.table}.low_price, EXCLUDED.low_price),
         volume      = ${this.table}.volume + EXCLUDED.volume`,
      [
        data.tokenId,
        data.interval,
        data.openPrice,
        data.highPrice,
        data.lowPrice,
        data.closePrice,
        data.volume,
        data.recordedAt,
      ],
    );
  }
}
