import { router } from "@/trpc/trpc";
import { playersRouter } from "./crud";
import { balanceRouter } from "./balance";
import { strikesRouter } from "./strikes";
import { bansRouter } from "./bans";
import { sessionsRouter } from "./sessions";
import { playtimeRouter } from "./playtime";
import { ticketsRouter } from "./tickets";
import { auditRouter } from "./audit";

/** Composite admin players router — CRUD, balance, strikes, bans, sessions, playtime, tickets, audit. */
export const adminPlayersRouter = router({
  players: playersRouter,
  balance: balanceRouter,
  strikes: strikesRouter,
  bans: bansRouter,
  sessions: sessionsRouter,
  playtime: playtimeRouter,
  tickets: ticketsRouter,
  audit: auditRouter,
});
