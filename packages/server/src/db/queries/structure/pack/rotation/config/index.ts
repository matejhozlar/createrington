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
    const existing = await this.db.query<StructurePackRotationConfigRow>(
      `SELECT * FROM structure_pack_rotation_config ORDER BY id LIMIT 1`,
    );
    const [row] = existing.rows;
    if (row) {
      return this.mapRowToEntity(row);
    }
    const created = await this.runQueryForRow<StructurePackRotationConfigRow>(
      "create default structure pack rotation config",
      `INSERT INTO structure_pack_rotation_config DEFAULT VALUES RETURNING *`,
    );
    return this.mapRowToEntity(created);
  }
}
