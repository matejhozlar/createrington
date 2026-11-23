import pool, { db, Q } from "./pool";
import * as repositories from "./repositories";

export { db, Q };

export const waitlistRepo = new repositories.WaitlistRepository();

export const playtimeRepo = new repositories.PlaytimeRepository();

export const balanceRepo = new repositories.BalanceRepository();

export const ticketRepo = new repositories.TicketRepository();

export const planningRepo = new repositories.PlanningRepository();

export const playerRepo = new repositories.PlayerRepository();

export const playerStrikeRepo = new repositories.PlayerStrikeRepository();

export const playerBanRepo = new repositories.PlayerBanRepository();

export const playerSessionRepo = new repositories.PlayerSessionRepository();

export const playerBalanceRepo = new repositories.PlayerBalanceRepository(
  balanceRepo,
);

export const playerTicketRepo = new repositories.PlayerTicketRepository();

export const playerAuditRepo = new repositories.PlayerAuditRepository();

export default pool;
