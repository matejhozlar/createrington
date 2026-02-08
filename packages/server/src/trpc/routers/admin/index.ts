import { router } from "../../trpc";
import { playersRouter } from "./players";
import { balanceRouter } from "./balance";
import { strikesRouter } from "./strikes";
import { bansRouter } from "./bans";
import { sessionsRouter } from "./sessions";
import { playtimeRouter } from "./playtime";
import { ticketsRouter } from "./tickets";
import { auditRouter } from "./audit";
import { waitlistsRouter } from "./waitlists";

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

export const adminWaitlistsRouter = waitlistsRouter;
