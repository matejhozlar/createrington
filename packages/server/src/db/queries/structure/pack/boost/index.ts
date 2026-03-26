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
    const result = await this.db.query<{ pack_id: number; total_units: string }>(
      `SELECT pack_id, SUM(units)::integer AS total_units
      FROM structure_pack_boost
      WHERE cycle_start = $1
      GROUP BY pack_id`,
      [cycleStart],
    );
    return result.rows.map((row) => ({
      packId: row.pack_id,
      totalUnits: Number(row.total_units),
    }));
  }

  async getPlayerBoostsForCycle(
    discordId: string,
    cycleStart: Date,
  ): Promise<StructurePackBoost[]> {
    const result = await this.db.query<StructurePackBoostRow>(
      `SELECT * FROM structure_pack_boost
      WHERE discord_id = $1 AND cycle_start = $2
      ORDER BY created_at DESC`,
      [discordId, cycleStart],
    );
    return result.rows.map((row) => this.mapRowToEntity(row));
  }

  async clearCycleBoosts(cycleStart: Date): Promise<void> {
    await this.db.query(
      `DELETE FROM structure_pack_boost WHERE cycle_start = $1`,
      [cycleStart],
    );
  }
}
