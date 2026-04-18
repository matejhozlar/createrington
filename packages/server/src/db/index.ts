/**
 * Database layer entry point
 *
 * Initializes the PostgreSQL connection pool and exposes three access patterns:
 * - `db` -- DatabaseQueries instance with transaction support
 * - `Q` -- singleton query instances for direct table access
 * - `R` -- repository singletons for complex business logic
 */

import pg from "pg";
import config from "@/config";
import {
  DatabaseQueries,
  createQueryInstances,
  createQueries,
} from "@/generated/db";
import * as repositories from "./repositories";

/**
 * PostgreSQL database pool instance using environment variables
 *
 * Environment variables used:
 * @env DB_USER - The PostgreSQL username
 * @env DB_HOST - The PostgreSQL host
 * @env DB_DATABASE - The name of the database
 * @env DB_PASSWORD - The database user's password
 * @env DB_PORT - The port PostgreSQL is running on
 */
const pool = new pg.Pool(config.database.pool);

// Parse PostgreSQL BIGINT (OID 20) as native BigInt instead of string
pg.types.setTypeParser(20, BigInt);

try {
  await pool.query("SELECT 1");
  logger.info("Connected to PostgreSQL database");
} catch (error) {
  logger.error("Failed to connect to DB:", error);
  process.exit(1);
}

// export const poolMonitor = new PoolMonitor(pool);
// poolMonitor.start();

/**
 * Primary database interface with transaction support
 *
 * @example
 * // Normal usage
 * await db.player.create({...});
 * await db.player.balance.findAll();
 *
 * @example
 * // Transactions
 * await db.inTransaction(async (tx) => {
 *  await tx.player.create({...});
 *  await tx.player.balance.create({...});
 * });
 */
export const db = new DatabaseQueries(pool);

/** Pre-built query instances sharing the pool -- use for non-transactional reads/writes */
export const Q = createQueryInstances(pool);

export const {
  player,
  discord,
  waitlist,
  admin,
  auth,
  server,
  leaderboard,
  faq,
} = Q;

export { createQueries };

/**
 * Export all actual query classes from the auto-generated barrel
 * This allows: import { PlayerQueries, AdminQueries } from "@/db"
 */
export * from "./queries";

export const waitlistRepo = new repositories.WaitlistRepository();

export const playtimeRepo = new repositories.PlaytimeRepository();

export const balanceRepo = new repositories.BalanceRepository();

export const donationRepo = new repositories.DonationRepository();

export const playerStrikeRepo = new repositories.PlayerStrikeRepository();

export const playerSessionRepo = new repositories.PlayerSessionRepository();

export const playerBalanceRepo = new repositories.PlayerBalanceRepository();

export const playerTicketRepo = new repositories.PlayerTicketRepository();

export const playerAuditRepo = new repositories.PlayerAuditRepository();

export const playerRepo = new repositories.PlayerRepository();

/** Convenience aggregate of all repository singletons */
export const R = {
  waitlistRepo,
  playtimeRepo,
  balanceRepo,
  donationRepo,
  playerRepo,
  playerAuditRepo,
  playerBalanceRepo,
  playerSessionRepo,
  playerTicketRepo,
  playerStrikeRepo,
};

export default pool;
export { transaction, Transaction } from "./utils/transactions";
