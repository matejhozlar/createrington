import type { Pool, PoolClient } from "pg";
import { StructurePackRotationConfigBaseQueries } from "@/generated/db/structure_pack_rotation_config.queries";
import type {
  StructurePackRotationConfig,
  StructurePackRotationConfigRow,
} from "@createrington/shared/db";

export class StructurePackRotationConfigQueries extends StructurePackRotationConfigBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }

  async getOrCreateDefault(): Promise<StructurePackRotationConfig> {
    const existing = await this.runQuery<StructurePackRotationConfigRow>(
      "get structure pack rotation config",
      `SELECT * FROM ${this.table} ORDER BY id LIMIT 1`,
    );
    if (existing.rows.length > 0) {
      return this.mapRowToEntity(existing.rows[0]);
    }
    const result = await this.runQuery<StructurePackRotationConfigRow>(
      "create default structure pack rotation config",
      `INSERT INTO ${this.table} DEFAULT VALUES RETURNING *`,
    );
    return this.mapRowToEntity(result.rows[0]);
  }
}
