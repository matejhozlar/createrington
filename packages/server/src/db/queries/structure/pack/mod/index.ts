import type { Pool, PoolClient } from "pg";
import { StructurePackModBaseQueries } from "@/generated/db/structure_pack_mod.queries";

export class StructurePackModQueries extends StructurePackModBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
