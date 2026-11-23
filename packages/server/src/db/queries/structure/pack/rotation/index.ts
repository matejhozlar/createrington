import type { Pool, PoolClient } from "pg";
import { StructurePackRotationBaseQueries } from "@/generated/db/structure_pack_rotation.queries";

export class StructurePackRotationQueries extends StructurePackRotationBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
