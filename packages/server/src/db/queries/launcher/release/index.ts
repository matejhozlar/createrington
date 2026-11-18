import type { Pool, PoolClient } from "pg";
import { LauncherReleaseBaseQueries } from "@/generated/db/launcher_release.queries";

export class LauncherReleaseQueries extends LauncherReleaseBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
