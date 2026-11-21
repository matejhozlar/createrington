import pg from "pg";
import config from "@/config";
import { DatabaseQueries, createQueryInstances } from "@/generated/db";
import * as repositories from "./repositories";
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

export const waitlistRepo = new repositories.WaitlistRepository();

export const playtimeRepo = new repositories.PlaytimeRepository();

export const balanceRepo = new repositories.BalanceRepository();

export const ticketRepo = new repositories.TicketRepository();

export const planningRepo = new repositories.PlanningRepository();

export const playerRepo = new repositories.PlayerRepository();

export const playerStrikeRepo = new repositories.PlayerStrikeRepository();

export const playerBanRepo = new repositories.PlayerBanRepository();

export const playerSessionRepo = new repositories.PlayerSessionRepository();

export const playerBalanceRepo = new repositories.PlayerBalanceRepository();

export const playerTicketRepo = new repositories.PlayerTicketRepository();

export const playerAuditRepo = new repositories.PlayerAuditRepository();

export default pool;
