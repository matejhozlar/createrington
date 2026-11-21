import type { Pool, PoolClient } from "pg";
import { StructurePackBoostBaseQueries } from "@/generated/db/structure_pack_boost.queries";
import type {
  StructurePackBoost,
  StructurePackBoostRow,
} from "@createrington/shared/db";

export class StructurePackBoostQueries extends StructurePackBoostBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getBoostsByPackForCycle(
    cycleStart: Date,
  ): Promise<Array<{ packId: number; totalUnits: number }>> {
    const result = await this.runQuery<{
      pack_id: number;
      total_units: number;
    }>(
      "get structure pack boosts for cycle",
      `SELECT pack_id, SUM(units)::int AS total_units
      FROM ${this.table}
      WHERE cycle_start = $1
      GROUP BY pack_id`,
      [cycleStart],
    );
    return this.mapRowsToEntities(result.rows);
  }

  async getPlayerBoostsForCycle(
    discordId: string,
    cycleStart: Date,
  ): Promise<StructurePackBoost[]> {
    const result = await this.runQuery<StructurePackBoostRow>(
      "get player structure pack boosts for cycle",
      `SELECT * FROM ${this.table}
      WHERE discord_id = $1 AND cycle_start = $2
      ORDER BY created_at DESC`,
      [discordId, cycleStart],
    );
    return this.mapRowsToEntities(result.rows);
  }

  async clearCycleBoosts(cycleStart: Date): Promise<void> {
    await this.runQuery(
      "clear structure pack cycle boosts",
      `DELETE FROM ${this.table} WHERE cycle_start = $1`,
      [cycleStart],
    );
  }
}
