import type { Pool, PoolClient } from "pg";
import { LauncherPackBaseQueries } from "@/generated/db/launcher_pack.queries";

export class LauncherPackQueries extends LauncherPackBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
