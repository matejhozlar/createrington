import type { Pool, PoolClient } from "pg";
import { AuthLauncherSessionBaseQueries } from "@/generated/db/auth_launcher_session.queries";

export class AuthLauncherSessionQueries extends AuthLauncherSessionBaseQueries {
  constructor(db: Pool | PoolClient) {
    super(db);
  }
}
