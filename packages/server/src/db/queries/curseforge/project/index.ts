import type { Pool, PoolClient } from "pg";
import { CurseforgeProjectBaseQueries } from "@/generated/db/curseforge_project.queries";

export class CurseforgeProjectQueries extends CurseforgeProjectBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
