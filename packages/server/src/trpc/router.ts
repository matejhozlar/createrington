import { router } from "./trpc";
import {
  serversRouter,
  playersRouter,
  waitlistsRouter,
  metricsRouter,
  authRouter,
} from "./routers";

export const appRouter = router({
  servers: serversRouter,
  players: playersRouter,
  waitlists: waitlistsRouter,
  metrics: metricsRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
