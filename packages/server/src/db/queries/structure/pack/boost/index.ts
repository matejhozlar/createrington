import type { Pool, PoolClient } from "pg";
import { StructurePackBoostBaseQueries } from "@/generated/db/structure_pack_boost.queries";

export class StructurePackBoostQueries extends StructurePackBoostBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
