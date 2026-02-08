import { router } from "./trpc";
import {
  serversRouter,
  playersRouter,
  waitlistsRouter,
  metricsRouter,
  authRouter,
  adminPlayersRouter,
  adminWaitlistsRouter,
} from "./routers";

export const appRouter = router({
  servers: serversRouter,
  players: playersRouter,
  waitlists: waitlistsRouter,
  metrics: metricsRouter,
  auth: authRouter,
  adminPlayers: adminPlayersRouter,
  adminWaitlists: adminWaitlistsRouter,
});

export type AppRouter = typeof appRouter;
