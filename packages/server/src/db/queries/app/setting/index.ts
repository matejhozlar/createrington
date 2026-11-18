import type { Pool, PoolClient } from "pg";
import { AppSettingBaseQueries } from "@/generated/db/app_setting.queries";

export class AppSettingQueries extends AppSettingBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
