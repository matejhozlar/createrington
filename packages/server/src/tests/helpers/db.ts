import pg from "pg";
import { createQueryInstances } from "@/generated/db/queries";
import type { QueryInstances } from "@/generated/db/queries";
import { DatabaseQueries } from "@/generated/db/db";

let testPool: pg.Pool | null = null;

/**
 * Get or create a test database pool from environment variables.
 * Defaults match the CI PostgreSQL service configuration.
 */
export function getTestPool(): pg.Pool {
  if (!testPool) {
    testPool = new pg.Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD ?? "test_password",
      database: process.env.DB_DATABASE ?? "test_db",
      ssl: false,
    });
  }
  return testPool;
}

/**
 * Get query instances backed by the test pool.
 */
export function getTestQueries(): QueryInstances {
  return createQueryInstances(getTestPool());
}

/**
 * Get a DatabaseQueries instance backed by the test pool (for transaction tests).
 */
export function getTestDb(): DatabaseQueries {
  return new DatabaseQueries(getTestPool());
}

/**
 * Truncate a table, resetting identity columns and cascading to dependents.
 */
export async function truncateTable(tableName: string): Promise<void> {
  await getTestPool().query(
    `TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`,
  );
}

/**
 * End the test pool. Call in afterAll.
 */
export async function cleanupTestPool(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}
