import type { Pool, PoolClient } from "pg";
import { ModpackBaseQueries } from "@/generated/db/modpack.queries";

export class ModpackQueries extends ModpackBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
