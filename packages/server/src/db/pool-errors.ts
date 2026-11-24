import type { Pool } from "pg";

export function logPoolErrors(pool: Pool): void {
  pool.on("error", (error) => {
    logger.warn(
      "Idle PostgreSQL connection failed, the pool replaces it:",
      error,
    );
  });
}
