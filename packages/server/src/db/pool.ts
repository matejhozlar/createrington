import pg from "pg";
import config from "@/config";
import { DatabaseQueries, createQueryInstances } from "@/generated/db";
import { registerPgTypeParsers } from "./utils/pg-types";

registerPgTypeParsers();

const pool = new pg.Pool(config.database.pool);

try {
  await pool.query("SELECT 1");
  logger.info("Connected to PostgreSQL database");
} catch (error) {
  logger.error("Failed to connect to DB:", error);
  process.exit(1);
}

export const db = new DatabaseQueries(pool);

export const Q = createQueryInstances(pool);

export default pool;
